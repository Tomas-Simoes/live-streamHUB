import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthStore } from 'src/app/features/auth/auth.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.currentUser()) {
    return true;
  }

  return authStore.loadCurrentUser().pipe(
    map((user) => user ? true : router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    })),
    catchError(() => of(router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    })))
  );
};
