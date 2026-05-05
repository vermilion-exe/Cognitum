export type ApiError = {
    status: number;
    message: string;
};

export function isApiError(error: unknown): error is ApiError {
    return typeof error === 'object'
        && error !== null
        && 'status' in error
        && 'message' in error
        && typeof (error as ApiError).status === 'number'
        && typeof (error as ApiError).message === 'string';
}
