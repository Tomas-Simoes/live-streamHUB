import { Component, OnInit } from "@angular/core";

import { AuthStore } from "./features/auth/auth.store";
import { HubStore } from "./core/hub.store";

@Component({
  selector: "app-root",
  standalone: false,
  template: "<router-outlet />",
})
export class AppComponent implements OnInit {
  constructor(
    private authStore: AuthStore,
    private hubStore: HubStore,
  ) {}

  ngOnInit() {
    this.authStore.loadCurrentUser().subscribe((user) => {
      if (user) {
        this.hubStore.loadMyHubs();
      }
    });
  }
}
