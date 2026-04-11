export const mapError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  } else {
    return JSON.stringify(error);
  }
};
