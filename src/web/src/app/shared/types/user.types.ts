export type User = {
    id: string,
    username: string,
    email: string
}

export type LoginRequest = {
    email: string,
    password: string
}

export type RegisterRequest = LoginRequest & {
    username: string
}

export type SecurityTokens = {
    accessToken: string,
    refreshToken: string,
    idToken: string
}
