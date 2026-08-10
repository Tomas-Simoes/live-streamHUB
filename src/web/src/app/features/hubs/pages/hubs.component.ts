import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { AuthStore } from "../../auth/auth.store";
import { HubLibraryPresenter } from "../presenters/hub-library.presenter";
import { HubStore } from "../state/hub.store";

@Component({
  selector: "app-hubs",
  standalone: false,
  templateUrl: "./hubs.component.html",
  styleUrls: ["./hubs.styles.css"],
  providers: [HubLibraryPresenter],
})
export class HubsComponent {
  constructor(
    private router: Router,
    private authStore: AuthStore,
    public hubStore: HubStore,
    public presenter: HubLibraryPresenter
  ) {}

  handleCreateHub() {
    this.hubStore.createHub().subscribe(() => {
      this.router.navigate(["/editor"]);
    });
  }

  handleEditHub(hubId: string) {
    this.hubStore.selectHub(hubId);
    this.router.navigate(["/editor"]);
  }

  logout() {
    this.authStore.logout().subscribe(() => {
      this.hubStore.hubs.set([]);
      this.hubStore.selectedHubId.set(null);
      this.router.navigate(["/login"]);
    });
  }
}
