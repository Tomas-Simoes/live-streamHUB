import { Component, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";

import { AuthStore } from "../../auth/auth.store";
import { HubLibraryPresenter } from "../presenters/hub-library.presenter";
import { HubStore } from "../../../core/hub.store";

type CarouselDirection = "next" | "previous";

@Component({
  selector: "app-hubs",
  standalone: false,
  templateUrl: "./hubs.component.html",
  styleUrls: ["./hubs.styles.css"],
  providers: [HubLibraryPresenter],
})
export class HubsComponent implements OnDestroy {
  carouselDirection: CarouselDirection = "next";
  isCarouselAnimating = false;
  private carouselAnimationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    private authStore: AuthStore,
    public hubStore: HubStore,
    public presenter: HubLibraryPresenter,
  ) {}

  ngOnDestroy() {
    this.clearCarouselAnimation();
  }

  handleCreateHub() {
    this.hubStore.createHub().subscribe(() => {
      this.router.navigate(["/editor"]);
    });
  }

  handleEditHub(hubId: string) {
    this.hubStore.selectHub(hubId);
    this.router.navigate(["/editor"]);
  }

  handleSelectPreviousHub() {
    this.animateCarousel("previous", () => this.presenter.selectPreviousHub());
  }

  handleSelectNextHub() {
    this.animateCarousel("next", () => this.presenter.selectNextHub());
  }

  handleSelectHub(hubId: string) {
    const currentIndex = this.presenter.selectedIndex();
    const targetIndex = this.presenter
      .entries()
      .findIndex((entry) => entry.hub._id === hubId);

    if (targetIndex === -1 || currentIndex === targetIndex) {
      return;
    }

    this.animateCarousel(targetIndex > currentIndex ? "next" : "previous", () =>
      this.hubStore.selectHub(hubId),
    );
  }

  logout() {
    this.authStore.logout().subscribe(() => {
      this.hubStore.hubs.set([]);
      this.hubStore.selectedHubId.set(null);
      this.router.navigate(["/login"]);
    });
  }

  private animateCarousel(direction: CarouselDirection, updateSelection: () => void) {
    this.clearCarouselAnimation();
    this.carouselDirection = direction;
    this.isCarouselAnimating = false;

    updateSelection();

    setTimeout(() => {
      this.isCarouselAnimating = true;
      this.carouselAnimationTimer = setTimeout(() => {
        this.isCarouselAnimating = false;
        this.carouselAnimationTimer = null;
      }, 500);
    });
  }

  private clearCarouselAnimation() {
    if (this.carouselAnimationTimer) {
      clearTimeout(this.carouselAnimationTimer);
      this.carouselAnimationTimer = null;
    }
  }
}
