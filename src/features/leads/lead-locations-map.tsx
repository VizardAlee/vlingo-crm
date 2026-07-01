"use client";

import Link from "next/link";
import { where, type QueryConstraint } from "firebase/firestore";
import { ExternalLink, MapPin, MapPinned, Navigation, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAllBranches, effectiveBranchId, hasAnyPermission, hasPermission, isAssignedOnlySalesUser, memberRoles } from "@/lib/permissions";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { listOrgRecords } from "@/services/repository";
import type { Lead } from "@/types/crm";

type MapScope = "activeBranch" | "allBranches";

type LeadWithLocation = Lead & {
  branchId?: string;
  assignedTo?: string;
};

function toNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function locationLabel(lead: LeadWithLocation) {
  return lead.geoAddress || [lead.preferredLocation, lead.preferredCity, lead.preferredState].filter(Boolean).join(", ") || "No location label";
}

function osmHref(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

function osmEmbedHref(latitude: number, longitude: number) {
  const spread = 0.01;
  const bbox = [
    longitude - spread,
    latitude - spread,
    longitude + spread,
    latitude + spread,
  ].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function LeadLocationsMap() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [records, setRecords] = useState<LeadWithLocation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mapScope, setMapScope] = useState<MapScope>("activeBranch");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReadLeads = hasAnyPermission(member, ["leads.readAssigned", "leads.readAll"]);
  const canViewAllBranches = canAccessAllBranches(member);
  const activeScopedBranchId = effectiveBranchId(member, activeBranchId);

  const geotaggedLeads = useMemo(() => records
    .map((lead) => ({
      ...lead,
      latitude: toNumber(lead.geoLatitude),
      longitude: toNumber(lead.geoLongitude),
    }))
    .filter((lead): lead is LeadWithLocation & { latitude: number; longitude: number } => (
      lead.latitude !== null && lead.longitude !== null
    )), [records]);

  const selectedLead = geotaggedLeads.find((lead) => lead.id === selectedId) ?? geotaggedLeads[0] ?? null;

  const bounds = useMemo(() => {
    if (!geotaggedLeads.length) {
      return null;
    }

    return geotaggedLeads.reduce(
      (current, lead) => ({
        maxLat: Math.max(current.maxLat, lead.latitude),
        maxLng: Math.max(current.maxLng, lead.longitude),
        minLat: Math.min(current.minLat, lead.latitude),
        minLng: Math.min(current.minLng, lead.longitude),
      }),
      {
        maxLat: geotaggedLeads[0].latitude,
        maxLng: geotaggedLeads[0].longitude,
        minLat: geotaggedLeads[0].latitude,
        minLng: geotaggedLeads[0].longitude,
      },
    );
  }, [geotaggedLeads]);

  const markerStyle = useCallback((latitude: number, longitude: number) => {
    if (!bounds) {
      return { left: "50%", top: "50%" };
    }

    const latRange = bounds.maxLat - bounds.minLat || 0.001;
    const lngRange = bounds.maxLng - bounds.minLng || 0.001;
    const left = ((longitude - bounds.minLng) / lngRange) * 86 + 7;
    const top = (1 - ((latitude - bounds.minLat) / latRange)) * 80 + 10;
    return { left: `${left}%`, top: `${top}%` };
  }, [bounds]);

  const loadLocations = useCallback(async () => {
    if (!canReadLeads || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [];
    const shouldUseAllBranches = canViewAllBranches && mapScope === "allBranches";
    if (!shouldUseAllBranches && activeScopedBranchId) {
      constraints.push(where("branchId", "==", activeScopedBranchId));
    }

    if (isAssignedOnlySalesUser(member) || !hasPermission(member, "leads.readAll")) {
      constraints.push(where("assignedTo", "==", user.uid));
    }

    try {
      const items = await listOrgRecords<LeadWithLocation>(activeOrganizationId, "leads", constraints);
      setRecords(items);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : "");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load lead locations.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, activeScopedBranchId, canReadLeads, canViewAllBranches, mapScope, member, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLocations();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadLocations]);

  if (!canReadLeads) {
    return (
      <PermissionDenied
        currentPermissions={member?.permissions}
        memberRole={memberRoles(member).join(", ") || member?.role}
        requiredPermissions={["leads.readAssigned", "leads.readAll"]}
        route="/leads/map"
      />
    );
  }

  if (loading) {
    return <LoadingState label="Loading lead locations" />;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Leads / Map</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lead Locations</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            View geotagged leads based on your assignment and branch access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewAllBranches ? (
            <Select className="w-44" value={mapScope} onChange={(event) => setMapScope(event.target.value as MapScope)}>
              <option value="activeBranch">Current branch</option>
              <option value="allBranches">All branches</option>
            </Select>
          ) : null}
          <Button onClick={() => void loadLocations()} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visible leads</p>
              <p className="text-xl font-semibold">{records.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Geotagged leads</p>
              <p className="text-xl font-semibold">{geotaggedLeads.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Scope</p>
              <p className="text-sm font-semibold">{mapScope === "allBranches" ? "All branches" : activeScopedBranchId || "Current branch"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!geotaggedLeads.length ? (
        <EmptyState actionHref="/leads/new" actionLabel="Create geotagged lead" title="No geotagged leads found." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Location Map</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="relative min-h-[340px] overflow-hidden rounded-md border bg-[linear-gradient(135deg,#e8f1e5_0%,#f9faf7_45%,#e9edf4_100%)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(25,83,20,0.18),transparent_28%),linear-gradient(90deg,rgba(15,66,12,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(15,66,12,0.08)_1px,transparent_1px)] bg-[length:100%_100%,44px_44px,44px_44px]" />
                {geotaggedLeads.map((lead) => (
                  <button
                    className={cn(
                      "absolute z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-primary text-white shadow-lg transition hover:scale-110",
                      selectedLead?.id === lead.id && "bg-secondary",
                    )}
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    style={markerStyle(lead.latitude, lead.longitude)}
                    title={lead.fullName}
                    type="button"
                  >
                    <MapPin className="h-4 w-4" />
                  </button>
                ))}
                <div className="absolute bottom-3 left-3 rounded-md border bg-white/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                  Click a pin to inspect the lead.
                </div>
              </div>

              {selectedLead ? (
                <div className="overflow-hidden rounded-md border">
                  <iframe
                    className="h-72 w-full"
                    loading="lazy"
                    src={osmEmbedHref(selectedLead.latitude, selectedLead.longitude)}
                    title={`Map preview for ${selectedLead.fullName}`}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid content-start gap-4">
            {selectedLead ? (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Lead</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div>
                    <Link className="text-base font-semibold text-primary hover:underline" href={`/leads/${selectedLead.id}`}>
                      {selectedLead.fullName}
                    </Link>
                    <p className="text-muted-foreground">{locationLabel(selectedLead)}</p>
                  </div>
                  <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p><span className="font-semibold text-foreground">Phone:</span> {selectedLead.phoneNumber}</p>
                    <p><span className="font-semibold text-foreground">Branch:</span> {selectedLead.branchId || "Not set"}</p>
                    <p><span className="font-semibold text-foreground">Status:</span> {titleCase(selectedLead.status)}</p>
                    <p><span className="font-semibold text-foreground">Captured:</span> {formatDate(selectedLead.geoCapturedAt)}</p>
                    {selectedLead.geoAccuracy ? <p><span className="font-semibold text-foreground">Accuracy:</span> {Math.round(Number(selectedLead.geoAccuracy))}m</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium text-primary hover:bg-muted" href={`/leads/${selectedLead.id}`}>
                      View lead
                    </Link>
                    <a className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium text-primary hover:bg-muted" href={osmHref(selectedLead.latitude, selectedLead.longitude)} rel="noreferrer" target="_blank">
                      <ExternalLink className="h-4 w-4" />
                      Open map
                    </a>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>All Geotagged Leads</CardTitle>
              </CardHeader>
              <CardContent className="grid max-h-[520px] gap-3 overflow-auto">
                {geotaggedLeads.map((lead) => (
                  <button
                    className={cn(
                      "rounded-md border bg-white p-3 text-left text-sm transition hover:border-primary/40 hover:bg-muted/30",
                      selectedLead?.id === lead.id && "border-primary bg-primary/5",
                    )}
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{lead.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{locationLabel(lead)}</p>
                      </div>
                      <Badge tone="info">{titleCase(lead.status)}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lead.latitude.toFixed(5)}, {lead.longitude.toFixed(5)}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
