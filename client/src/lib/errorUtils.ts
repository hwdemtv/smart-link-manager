import { TFunction } from "i18next";
import { TRPCClientError } from "@trpc/client";
import { ErrorCodes } from "@shared/errorCodes";

/**
 * Translates a backend error code to a localized message.
 * If the error code is not recognized, returns a generic error message.
 *
 * @param t - The translation function from useTranslation
 * @param errorCode - The error code from the backend
 * @returns Localized error message
 */
export function translateServerError(t: TFunction, errorCode: string): string {
  // Check if the error code exists in our known codes
  if (Object.values(ErrorCodes).includes(errorCode as any)) {
    return t(`serverError.${errorCode}`);
  }
  // Return the error code itself if it looks like one, or a generic message
  return t("serverError.UNKNOWN_ERROR");
}

/**
 * Extracts error message from a TRPC error and translates it.
 *
 * @param t - The translation function from useTranslation
 * @param error - The TRPC error
 * @returns Localized error message
 */
export function handleTrpcError(t: TFunction, error: unknown): string {
  if (error instanceof TRPCClientError) {
    const message = error.message;

    // Check if the message is an error code
    if (Object.values(ErrorCodes).includes(message as any)) {
      return translateServerError(t, message);
    }

    // Return the original message if it's not an error code
    // (for backwards compatibility with any remaining hardcoded messages)
    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t("serverError.UNKNOWN_ERROR");
}

/**
 * Checks if an error message is a known error code.
 *
 * @param message - The error message to check
 * @returns True if the message is a known error code
 */
export function isErrorCode(message: string): boolean {
  return Object.values(ErrorCodes).includes(message as any);
}
