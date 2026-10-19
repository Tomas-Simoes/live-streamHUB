import { Component, OnDestroy, signal } from "@angular/core";
import { Router } from "@angular/router";
import { finalize } from "rxjs";

import { AuthStore } from "../../auth/auth.store";
import { HubLibraryPresenter } from "../presenters/hub-library.presenter";
import { HubStore } from "../../../core/store/hub.store";
import { PREDEFINED_HUB_TEMPLATES } from "../../../shared/templates/predefined-hub-templates";

type CarouselDirection = "next" | "previous";

@Component({
  selector: "app-hubs",
  standalone: false,
  templateUrl: "./hubs.component.html",
  styleUrls: ["./hubs.styles.css"],
  providers: [HubLibraryPresenter],
})
export class HubsComponent implements OnDestroy {
  readonly hubTemplates = PREDEFINED_HUB_TEMPLATES;
  readonly libraryView = signal<'hubs' | 'templates'>('templates');
  readonly selectedTemplate = signal(PREDEFINED_HUB_TEMPLATES[0]);
  readonly isCreatingTemplate = signal(false);
  readonly templateError = signal<string | null>(null);
  carouselDirection: CarouselDirection = "next";
  isCarouselAnimating = false;
  readonly isDeletingHub = signal(false);
  readonly deleteError = signal<string | null>(null);
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

  handleCreateTemplateHub(templateId: string) {
    if (this.isCreatingTemplate()) return;

    this.isCreatingTemplate.set(true);
    this.templateError.set(null);
    this.hubStore.createHubFromTemplate(templateId)
      .pipe(finalize(() => this.isCreatingTemplate.set(false)))
      .subscribe({
        next: () => this.router.navigate(["/editor"]),
        error: () => this.templateError.set('Could not create this hub. Please try again.'),
      });
  }

  handleSelectTemplate(templateId: string) {
    const template = this.hubTemplates.find((entry) => entry.id === templateId);
    if (template) {
      this.selectedTemplate.set(template);
      this.templateError.set(null);
    }
  }

  handleEditHub(hubId: string) {
    this.hubStore.selectHub(hubId);
    this.router.navigate(["/editor"]);
  }

  handleDeleteHub() {
    const hub = this.hubStore.selectedHub();

    if (!hub || this.isDeletingHub()) {
      return;
    }

    if (!window.confirm(`Delete "${hub.hubName || "Untitled Hub"}"? This cannot be undone.`)) {
      return;
    }

    this.deleteError.set(null);
    this.isDeletingHub.set(true);
    this.hubStore.deleteHub(hub._id)
      .pipe(finalize(() => this.isDeletingHub.set(false)))
      .subscribe({
        error: () => {
          this.deleteError.set("Could not delete the hub. Please try again.");
        },
      });
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

  private animateCarousel(
    direction: CarouselDirection,
    updateSelection: () => void,
  ) {
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
