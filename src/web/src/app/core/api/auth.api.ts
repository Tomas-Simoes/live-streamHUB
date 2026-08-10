import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { env } from 'src/env/env';
import { LoginRequest, RegisterRequest, SecurityTokens, User } from 'src/app/shared/types/user.types';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly baseUrl = `${env.apiUrl}/auth`;
  private readonly httpOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  login(data: LoginRequest) {
    return this.http.post<SecurityTokens>(`${this.baseUrl}/login`, data, this.httpOptions);
  }

  register(data: RegisterRequest) {
    return this.http.post<User>(`${this.baseUrl}/register`, data, this.httpOptions);
  }

  getMe() {
    return this.http.get<User>(`${this.baseUrl}/me`, this.httpOptions);
  }

  logout() {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/logout`, {}, this.httpOptions);
  }
}
