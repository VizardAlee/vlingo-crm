export interface InventoryDestinationAccessInput {
  activeBranchId: string;
  actorCanAccessDestination: boolean;
  destinationBranchId: string;
  destinationExists: boolean;
  destinationIsCanonicalBranch: boolean;
  movementType: string;
}

export function canUseInventoryDestination({
  activeBranchId,
  actorCanAccessDestination,
  destinationBranchId,
  destinationExists,
  destinationIsCanonicalBranch,
  movementType,
}: InventoryDestinationAccessInput) {
  if (!destinationExists) return false;
  if (movementType === "transfer") return destinationIsCanonicalBranch;
  return actorCanAccessDestination && destinationBranchId === activeBranchId;
}
