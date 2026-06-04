"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { type ZodType } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { type ModuleConfig } from "@/features/modules/module-config";
import { activitySchema, clientSchema, leadSchema, propertySchema, taskSchema, unitSchema } from "@/lib/validation/schemas";
import { createOrgRecord, updateOrgRecord, writeAuditLog } from "@/services/repository";

const schemaByCollection: Record<string, ZodType> = {
  activities: activitySchema,
  clients: clientSchema,
  leads: leadSchema,
  properties: propertySchema,
  propertyUnits: unitSchema,
  tasks: taskSchema,
};

type FormValues = Record<string, string | number | string[] | undefined>;

export function ModuleForm({ config, existing, id }: { config: ModuleConfig; existing?: FormValues; id?: string }) {
  const router = useRouter();
  const { activeBranchId, activeOrganizationId, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const schema = schemaByCollection[config.collection];
  const {
    formState: { isSubmitting },
    handleSubmit,
    register,
  } = useForm<FormValues>({
    defaultValues: existing ?? Object.fromEntries(config.fields.map((field) => [field.name, field.options?.[0] ?? ""])),
  });

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

  return (
    <Card>
      <CardContent>
        <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
          {error ? <ErrorState message={error} /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {config.fields.map((field) => (
              <Field key={field.name} label={field.label} error={validationErrors[field.name]}>
                {field.type === "textarea" ? (
                  <Textarea {...register(field.name)} />
                ) : field.type === "select" ? (
                  <Select {...register(field.name)}>
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                ) : (
                  <Input {...register(field.name)} type={field.type} />
                )}
              </Field>
            ))}
          </div>
          <div className="flex justify-end">
            <Button disabled={isSubmitting} type="submit">
              <Save className="h-4 w-4" />
              {isSubmitting ? "Saving" : "Save record"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
