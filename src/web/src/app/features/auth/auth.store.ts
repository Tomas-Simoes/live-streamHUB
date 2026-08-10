import { computed, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, switchMap, tap } from 'rxjs';

import { AuthApi } from 'src/app/core/api/auth.api';
import { LoginRequest, RegisterRequest, User } from 'src/app/shared/types/user.types';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  currentUser = signal<User | null>(null);
  isLoading = signal(false);
  authChecked = signal(false);
  isAuthenticated = computed(() => this.currentUser() !== null);

  constructor(private authApi: AuthApi) {}

  loadCurrentUser(): Observable<User | null> {
    this.isLoading.set(true);

    return this.authApi.getMe().pipe(
      tap((user) => this.currentUser.set(user)),
      map((user) => user),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      }),
      finalize(() => {
        this.authChecked.set(true);
        this.isLoading.set(false);
      })
    );
  }

  login(data: LoginRequest): Observable<User | null> {
    this.isLoading.set(true);

    return this.authApi.login(data).pipe(
      switchMap(() => this.loadCurrentUser()),
      finalize(() => this.isLoading.set(false))
    );
  }

  register(data: RegisterRequest): Observable<User | null> {
    this.isLoading.set(true);

    return this.authApi.register(data).pipe(
      switchMap(() => this.authApi.login({ email: data.email, password: data.password })),
      switchMap(() => this.loadCurrentUser()),
      finalize(() => this.isLoading.set(false))
    );
  }

  logout(): Observable<boolean> {
    this.isLoading.set(true);

    return this.authApi.logout().pipe(
      map(() => true),
      catchError(() => of(true)),
      tap(() => {
        this.currentUser.set(null);
        this.authChecked.set(true);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }
}
