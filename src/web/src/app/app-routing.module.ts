import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { EditorComponent } from "./features/editor/components/editor.component";
import { AuthFormComponent } from "./features/auth/components/auth-form.component";
import { HomeComponent } from "./features/home/components/home.component";
import { HubsComponent } from "./features/hubs/pages/hubs.component";
import { authGuard } from "./core/guards/auth.guard";
import { OverlayComponent } from "./features/overlay/pages/overlay.component";

const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "login", component: AuthFormComponent },
  { path: "register", component: AuthFormComponent },
  { path: "editor", component: EditorComponent, canActivate: [authGuard] },
  { path: "hubs", component: HubsComponent, canActivate: [authGuard] },
  { path: "overlay/:userId/:hubId", component: OverlayComponent },
  { path: "**", redirectTo: "" },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: "enabled",
      bindToComponentInputs: true,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
