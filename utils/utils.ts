// jwt decoder and return the payload

export const decodeJWT = (token: string) => {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
}

