"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { type ZodType } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { type FormField, type ModuleConfig } from "@/features/modules/module-config";
import { activitySchema, clientSchema, leadSchema, propertySchema, taskSchema, unitSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";
import { createOrgRecord, listOrgRecords, updateOrgRecord, writeAuditLog } from "@/services/repository";
import type { Member, Property, PropertyStakeholder } from "@/types/crm";

const schemaByCollection: Record<string, ZodType> = {
  activities: activitySchema,
  clients: clientSchema,
  leads: leadSchema,
  properties: propertySchema,
  propertyUnits: unitSchema,
  tasks: taskSchema,
};

type FormValues = Record<string, string | number | string[] | undefined>;
type SelectOption = { label: string; value: string };
type StakeholderKind = "developer" | "management" | "owner";
type FormValue = FormValues[string];

function calculateFeeAmount(type: string, value: number, baseAmount: number) {
  if (!value || type === "none") {
    return 0;
  }

  if (type === "percentage") {
    return Math.round((baseAmount * value) / 100);
  }

  return value;
}

function toStakeholderOption(stakeholder: PropertyStakeholder): SelectOption {
  const detail = [stakeholder.phoneNumber, stakeholder.email].filter(Boolean).join(" · ");
  return {
    label: detail ? `${stakeholder.name} (${detail})` : stakeholder.name,
    value: stakeholder.id,
  };
}

function groupFields(fields: FormField[]) {
  return fields.reduce<Array<{ fields: FormField[]; title: string }>>((sections, field) => {
    const title = field.section ?? "Details";
    const existing = sections.find((section) => section.title === title);
    if (existing) {
      existing.fields.push(field);
      return sections;
    }

    return [...sections, { fields: [field], title }];
  }, []);
}

function isBlankFormValue(value: FormValue) {
  return value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

function dateInputValue(value: unknown) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString().slice(0, 10);
  }

  return "";
}

export function ModuleForm({ config, existing, id, initialValues }: { config: ModuleConfig; existing?: FormValues; id?: string; initialValues?: FormValues }) {
  const router = useRouter();
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [stakeholderForm, setStakeholderForm] = useState({ email: "", name: "", notes: "", phoneNumber: "", type: "owner" as StakeholderKind });
  const [stakeholders, setStakeholders] = useState<PropertyStakeholder[]>([]);
  const [stakeholderSaving, setStakeholderSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const schema = schemaByCollection[config.collection];
  const {
    control,
    formState: { isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = useForm<FormValues>({
    defaultValues: existing ?? {
      ...Object.fromEntries(config.fields.map((field) => [field.name, field.required ? field.options?.[0] ?? "" : ""])),
      ...initialValues,
    },
  });

  const sections = groupFields(config.fields);
  const [askingPrice, rentAmount, agencyFeeType, agencyFeeValue, commissionType, commissionValue] = useWatch({
    control,
    name: ["askingPrice", "rentAmount", "agencyFeeType", "agencyFeeValue", "commissionType", "commissionValue"],
  });
  const basePropertyAmount = Number(askingPrice || rentAmount || 0);
  const agencyFee = calculateFeeAmount(String(agencyFeeType ?? ""), Number(agencyFeeValue || 0), basePropertyAmount);
  const commissionAmount = calculateFeeAmount(String(commissionType ?? ""), Number(commissionValue || 0), basePropertyAmount);
  const selectedPropertyId = useWatch({ control, name: "propertyId" });

  const ownerOptions = useMemo(() => stakeholders.filter((item) => item.type === "owner").map(toStakeholderOption), [stakeholders]);
  const developerOptions = useMemo(() => stakeholders.filter((item) => item.type === "developer").map(toStakeholderOption), [stakeholders]);
  const managementOptions = useMemo(() => stakeholders.filter((item) => item.type === "management").map(toStakeholderOption), [stakeholders]);
  const managerOptions = useMemo(
    () => members.map((item) => {
      const name = item.displayName || item.email || item.id;
      const detail = [item.role, item.email].filter(Boolean).join(" · ");
      return { label: `${name} (${detail})`, value: item.id };
    }),
    [members],
  );
  const propertyOptions = useMemo(
    () => properties.map((item) => {
      const detail = [item.city, item.referenceNumber].filter(Boolean).join(" · ");
      return { label: detail ? `${item.name} (${detail})` : item.name, value: item.id };
    }),
    [properties],
  );

  useEffect(() => {
    if (config.collection !== "properties" && config.collection !== "propertyUnits" && config.collection !== "tasks") {
      return;
    }

    let mounted = true;
    const loadOptions = (() => {
      if (config.collection === "propertyUnits") {
        return Promise.all([
          Promise.resolve<PropertyStakeholder[]>([]),
          Promise.resolve<Member[]>([]),
          listOrgRecords<Property>(activeOrganizationId, "properties").catch(() => []),
        ]);
      }

      if (config.collection === "tasks") {
        return Promise.all([
          Promise.resolve<PropertyStakeholder[]>([]),
          listOrgRecords<Member>(activeOrganizationId, "members").catch(() => member ? [member] : []),
          Promise.resolve<Property[]>([]),
        ]);
      }

      return Promise.all([
        listOrgRecords<PropertyStakeholder>(activeOrganizationId, "propertyStakeholders").catch(() => []),
        listOrgRecords<Member>(activeOrganizationId, "members").catch(() => member ? [member] : []),
        Promise.resolve<Property[]>([]),
      ]);
    })();

    loadOptions
      .then(([nextStakeholders, nextMembers, nextProperties]) => {
        if (!mounted) {
          return;
        }

        setStakeholders(nextStakeholders);
        setMembers(nextMembers);
        setProperties(nextProperties);
      });

    return () => {
      mounted = false;
    };
  }, [activeOrganizationId, config.collection, member]);

  useEffect(() => {
    if (config.collection !== "propertyUnits" || !selectedPropertyId) {
      return;
    }

    const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
    if (!selectedProperty) {
      return;
    }

    function setUnitDefault(fieldName: string, nextValue: FormValue) {
      if (isBlankFormValue(nextValue)) {
        return;
      }

      const currentValue = getValues(fieldName);
      const canReplaceDefaultStatus = fieldName === "status" && !id && currentValue === "draft";
      if (isBlankFormValue(currentValue) || canReplaceDefaultStatus) {
        setValue(fieldName, nextValue, { shouldDirty: true, shouldValidate: false });
      }
    }

    setUnitDefault("status", selectedProperty.propertyStatus);
    setUnitDefault("size", selectedProperty.size);
    setUnitDefault("sizeUnit", selectedProperty.sizeUnit);
    setUnitDefault("bedrooms", selectedProperty.bedrooms);
    setUnitDefault("bathrooms", selectedProperty.bathrooms);
    setUnitDefault("toilets", selectedProperty.toilets);
    setUnitDefault("parkingSpaces", selectedProperty.parkingSpaces);
    setUnitDefault("furnishingStatus", selectedProperty.furnishingStatus);
    setUnitDefault("features", selectedProperty.features?.join(", "));
    setUnitDefault("askingPrice", selectedProperty.askingPrice);
    setUnitDefault("rentAmount", selectedProperty.rentAmount);
    setUnitDefault("serviceCharge", selectedProperty.serviceCharge);
    setUnitDefault("cautionFee", selectedProperty.cautionFee);
    setUnitDefault("legalFee", selectedProperty.legalFee);
    setUnitDefault("availabilityDate", dateInputValue(selectedProperty.availabilityDate));
  }, [config.collection, getValues, id, properties, selectedPropertyId, setValue]);

  async function onSubmit(values: FormValues) {
    if (!user) {
      setError("You must be signed in to save records.");
      return;
    }

    setError(null);
    setValidationErrors({});
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setValidationErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }

    const parsedData = parsed.data as Record<string, unknown>;
    if (config.collection === "properties") {
      parsedData.agencyFee = agencyFee;
      parsedData.commissionAmount = commissionAmount;
    }

    if (config.collection === "propertyUnits") {
      const linkedProperty = properties.find((property) => property.id === parsedData.propertyId);
      parsedData.propertyName = linkedProperty?.name ?? "";
      parsedData.propertyReferenceNumber = linkedProperty?.referenceNumber ?? "";
    }

    if (config.collection === "leads" && !parsedData.assignedTo) {
      parsedData.assignedTo = user.uid;
    }

    if (config.collection === "tasks" && !parsedData.assignedTo) {
      parsedData.assignedTo = user.uid;
    }

    if (config.collection === "tasks") {
      const assignedMember = members.find((item) => item.id === parsedData.assignedTo);
      parsedData.assignedToName = assignedMember?.displayName ?? "";
      parsedData.assignedToEmail = assignedMember?.email ?? "";
    }

    const context = { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid };
    try {
      if (id) {
        await updateOrgRecord(config.collection, id, parsedData, context);
        await writeAuditLog(context, "record.update", config.collection, id, parsedData);
      } else {
        const createdId = await createOrgRecord(config.collection, parsedData, context, config.prefix);
        await writeAuditLog(context, "record.create", config.collection, createdId, parsedData);
      }

      router.push(config.route);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save record.");
    }
  }

  function optionsForField(field: FormField): SelectOption[] {
    if (field.optionSource === "propertyOwners") {
      return ownerOptions;
    }

    if (field.optionSource === "propertyDevelopers") {
      return developerOptions;
    }

    if (field.optionSource === "managementCompanies") {
      return managementOptions;
    }

    if (field.optionSource === "properties") {
      return propertyOptions;
    }

    if (field.optionSource === "internalManagers") {
      return managerOptions;
    }

    return field.options?.map((option) => ({ label: option, value: option })) ?? [];
  }

  async function createStakeholder() {
    if (!user) {
      setError("You must be signed in to create ownership records.");
      return;
    }

    if (!stakeholderForm.name.trim()) {
      setError("Enter a name before creating the ownership record.");
      return;
    }

    const context = { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid };
    setStakeholderSaving(true);
    setError(null);
    try {
      const stakeholderId = await createOrgRecord("propertyStakeholders", {
        email: stakeholderForm.email.trim(),
        name: stakeholderForm.name.trim(),
        notes: stakeholderForm.notes.trim(),
        phoneNumber: stakeholderForm.phoneNumber.trim(),
        status: "active",
        type: stakeholderForm.type,
      }, context, "PTY");
      await writeAuditLog(context, "propertyStakeholder.create", "propertyStakeholders", stakeholderId, stakeholderForm);
      const nextStakeholders = await listOrgRecords<PropertyStakeholder>(activeOrganizationId, "propertyStakeholders");
      setStakeholders(nextStakeholders);

      if (stakeholderForm.type === "owner") {
        setValue("propertyOwnerId", stakeholderId);
      } else if (stakeholderForm.type === "developer") {
        setValue("developerId", stakeholderId);
      } else {
        setValue("managementCompanyId", stakeholderId);
      }

      setStakeholderForm({ email: "", name: "", notes: "", phoneNumber: "", type: stakeholderForm.type });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create ownership record.");
    } finally {
      setStakeholderSaving(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
          {error ? <ErrorState message={error} /> : null}
          <div className="grid gap-6">
            {sections.map((section) => (
              <section className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0" key={section.title}>
                <div>
                  <h2 className="text-base font-semibold">{section.title}</h2>
                </div>
                {config.collection === "properties" && section.title === "Ownership and management" ? (
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
                    <div className="grid gap-3 lg:grid-cols-4">
                      <Field label="Record type">
                        <Select value={stakeholderForm.type} onChange={(event) => setStakeholderForm((current) => ({ ...current, type: event.target.value as StakeholderKind }))}>
                          <option value="owner">Owner</option>
                          <option value="developer">Developer</option>
                          <option value="management">Management</option>
                        </Select>
                      </Field>
                      <Field label="Name">
                        <Input value={stakeholderForm.name} onChange={(event) => setStakeholderForm((current) => ({ ...current, name: event.target.value }))} />
                      </Field>
                      <Field label="Phone">
                        <Input value={stakeholderForm.phoneNumber} onChange={(event) => setStakeholderForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
                      </Field>
                      <Field label="Email">
                        <Input type="email" value={stakeholderForm.email} onChange={(event) => setStakeholderForm((current) => ({ ...current, email: event.target.value }))} />
                      </Field>
                    </div>
                    <Field label="Notes">
                      <Textarea value={stakeholderForm.notes} onChange={(event) => setStakeholderForm((current) => ({ ...current, notes: event.target.value }))} />
                    </Field>
                    <div className="flex justify-end">
                      <Button disabled={stakeholderSaving} onClick={createStakeholder} type="button" variant="outline">
                        {stakeholderSaving ? "Creating" : "Create record"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-4 lg:grid-cols-2">
                  {section.fields.map((field) => (
                    <Field className={cn(field.colSpan === "full" && "lg:col-span-2")} key={field.name} label={field.label} error={validationErrors[field.name]}>
                      <div className="grid gap-1.5">
                        {field.type === "textarea" ? (
                          <Textarea placeholder={field.placeholder} readOnly={field.readOnly} {...register(field.name)} />
                        ) : field.type === "select" ? (
                          <Select {...register(field.name)}>
                            <option value="">Select {field.label.toLowerCase()}</option>
                            {optionsForField(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </Select>
                        ) : field.name === "agencyFee" ? (
                          <Input readOnly type="number" value={agencyFee} />
                        ) : field.name === "commissionAmount" ? (
                          <Input readOnly type="number" value={commissionAmount} />
                        ) : (
                          <Input placeholder={field.placeholder} readOnly={field.readOnly} {...register(field.name)} type={field.type} />
                        )}
                        {field.helpText ? <span className="text-xs font-normal text-muted-foreground">{field.helpText}</span> : null}
                      </div>
                    </Field>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] -mx-5 -mb-5 border-t bg-white p-4 md:static md:m-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
            <Button className="h-12 w-full md:h-10 md:w-auto" disabled={isSubmitting} type="submit">
              <Save className="h-4 w-4" />
              {isSubmitting ? "Saving" : "Save record"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
