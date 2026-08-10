import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { HubStore } from '../../hubs/state/hub.store';
import { AuthStore } from '../auth.store';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-form',
  standalone: false,
  templateUrl: './auth-form.component.html',
  styleUrls: ['../styles/auth-form.styles.css'],
})
export class AuthFormComponent {
  email = '';
  password = '';
  username = '';
  errorMessage = signal<string | null>(null);
  isSubmitting = signal(false);
  mode = signal<AuthMode>('login');
  isRegisterMode = computed(() => this.mode() === 'register');

  constructor(
    public authStore: AuthStore,
    private hubStore: HubStore,
    public route: ActivatedRoute,
    private router: Router
  ) {
    this.mode.set(this.route.snapshot.routeConfig?.path === 'register' ? 'register' : 'login');
  }

  submit() {
    this.errorMessage.set(null);

    if (!this.email.trim() || !this.password.trim() || (this.isRegisterMode() && !this.username.trim())) {
      this.errorMessage.set('Fill in every required field.');
      return;
    }

    this.isSubmitting.set(true);
    const request = this.isRegisterMode()
      ? this.authStore.register({
        username: this.username.trim(),
        email: this.email.trim(),
        password: this.password,
      })
      : this.authStore.login({
        email: this.email.trim(),
        password: this.password,
      });

    request.subscribe({
      next: () => {
        this.hubStore.loadMyHubs();
        this.router.navigateByUrl(this.getReturnUrl());
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isSubmitting.set(false);
      },
      complete: () => this.isSubmitting.set(false),
    });
  }

  private getReturnUrl() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    return returnUrl?.startsWith('/') ? returnUrl : '/hubs';
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.message;

      if (Array.isArray(serverMessage)) {
        return serverMessage.join(' ');
      }

      if (typeof serverMessage === 'string') {
        return serverMessage;
      }
    }

    return this.isRegisterMode()
      ? 'Could not create that account.'
      : 'Could not sign you in.';
  }
}
