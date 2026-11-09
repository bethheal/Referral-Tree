const DEVELOPMENT_IMPORT_TARGET = "angelfoods-dev";

export const requireDevelopmentImportConfirmation = (
  apply: boolean,
  confirmation: string | undefined,
) => {
  if (apply && confirmation !== DEVELOPMENT_IMPORT_TARGET) {
    throw new Error("Import stopped: set CONFIRM_DB_MIGRATION=angelfoods-dev to apply this import.");
  }
};

export const requireDevelopmentImportDatabase = (
  target: string,
  endpointId: string | null,
) => {
  if (target !== DEVELOPMENT_IMPORT_TARGET || !endpointId) {
    throw new Error("Import stopped: JSON imports are allowed only for the validated angelfoods-dev Neon endpoint.");
  }
};
