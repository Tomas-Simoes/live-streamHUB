import { Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { GameDataApi } from "src/app/core/api/game-data.api";
import { OverlayApi } from "src/app/core/api/overlay.api";
import { EditorLayer, LayerType } from "src/app/shared/types/layer.types";

@Component({
  selector: "app-overlay",
  standalone: false,
  templateUrl: "./overlay.component.html",
  styleUrls: ["./overlay.styles.css"],
})
export class OverlayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly overlayApi = inject(OverlayApi);
  readonly live = inject(GameDataApi);
  readonly LayerType = LayerType;

  userId = "";
  hubId = "";
  layers = signal<EditorLayer[]>([]);

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get("userId") ?? "";
    this.hubId = this.route.snapshot.paramMap.get("hubId") ?? "";

    if (this.userId && this.hubId) {
      this.overlayApi.getHub(this.userId, this.hubId).subscribe({
        next: (hub) => {
          this.layers.set((hub.layout?.["layers"] ?? []) as EditorLayer[]);
        },
        error: () => {
          this.layers.set([]);
        },
      });
    }

    this.live.connect();
  }

  ngOnDestroy() {
    this.live.disconnect();
  }

  getLayerStyle(layer: EditorLayer) {
    return {
      left: `${layer.position.x}px`,
      top: `${layer.position.y}px`,
      width: `${layer.width}px`,
      height: `${layer.height}px`,
    };
  }

  getLayerText(layer: EditorLayer) {
    switch (layer.type) {
      case LayerType.Text:
        return layer.text;
      case LayerType.Kills:
        return this.readFeature("team.blue.kills");
      case LayerType.Towers:
        return this.readFeature("team.blue.objectives");
      default:
        return "";
    }
  }

  readFeature(path: string) {
    const state = this.live.state();
    return path.split(".").reduce<any>((value, key) => value?.[key], state) ?? "";
  }
}
