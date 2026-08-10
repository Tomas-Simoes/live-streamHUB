import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AuthFormComponent } from './components/auth-form.component';

@NgModule({
  declarations: [AuthFormComponent],
  imports: [FormsModule, RouterModule],
  exports: [AuthFormComponent],
})
export class AuthModule {}
