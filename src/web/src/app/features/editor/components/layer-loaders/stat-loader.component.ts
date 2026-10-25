import { Component, Input } from '@angular/core';
import { getComponentPartCss } from '../../../../shared/helpers/layer-style.helpers';
import { nativeRosterTracks } from '../../../../shared/helpers/roster-fields';

import {
  formatGold,
  formatGoldDiff,
  formatKda,
  getChampionImageUrl,
  getItemImageUrl,
  getPreviewPlayer,
  getPreviewTeam,
  LEAGUE_PREVIEW_DATA,
  LOL_ROLE_OPTIONS,
  LeaguePreviewItem,
  LeaguePreviewPlayer,
} from '../../../../shared/data/league-preview-data';
import {
  ChampionPortraitLayer,
  LayerType,
  LolPlayerRosterLayer,
  LolScorebugLayer,
  PlayerItemsLayer,
  StatLayer,
  StatLayerTeam,
} from '../../../../shared/types/layer.types';

@Component({
  selector: 'app-stat-loader',
  standalone: false,
  template: `
    @switch(layer.type) {
    @case(LayerType.LolScorebug) {
    <div class="scorebug" data-component-part="surface" [style.--blue-accent]="layer.blueAccent" [style.--red-accent]="layer.redAccent">
      <div class="scorebug-team scorebug-team-blue" data-component-part="blue-team" [ngStyle]="partStyle(layer, 'blue-team')">
        <span class="team-logo" data-component-part="blue-logo" [ngStyle]="partStyle(layer, 'blue-logo')">{{ getTeamLogoText(layer.blueTeamCode) }}</span>
        <span class="team-lockup">
          <span class="team-code" data-component-part="blue-code" [ngStyle]="partStyle(layer, 'blue-code')">{{ layer.blueTeamCode }}</span>
          <span class="team-seed" data-component-part="blue-seed" [ngStyle]="partStyle(layer, 'blue-seed')">{{ getScorebugTeam(layer, 'blue').seed }}</span>
        </span>
        @if(layer.showGold) {
        <span class="team-gold" data-component-part="blue-gold" [ngStyle]="partStyle(layer, 'blue-gold')">{{ formatTeamGold(getScorebugTeam(layer, 'blue').gold) }}</span>
        }
        @if(layer.showObjectives) {
        <span class="team-objective" data-component-part="blue-towers" [ngStyle]="partStyle(layer, 'blue-towers')">T{{ getScorebugTeam(layer, 'blue').towers }}</span>
        }
      </div>

      <div class="scorebug-center" data-component-part="center" [ngStyle]="partStyle(layer, 'center')">
        <span class="team-kills" data-component-part="blue-kills" [ngStyle]="partStyle(layer, 'blue-kills')">{{ getScorebugTeam(layer, 'blue').kills }}</span>
        <span class="score-divider"></span>
        <span class="team-kills" data-component-part="red-kills" [ngStyle]="partStyle(layer, 'red-kills')">{{ getScorebugTeam(layer, 'red').kills }}</span>
        @if(layer.showGameTime) {
        <span class="game-clock" data-component-part="clock" [ngStyle]="partStyle(layer, 'clock')">{{ layer.gameTime || previewData.gameTime }}</span>
        }
      </div>

      <div class="scorebug-team scorebug-team-red" data-component-part="red-team" [ngStyle]="partStyle(layer, 'red-team')">
        @if(layer.showObjectives) {
        <span class="team-objective" data-component-part="red-towers" [ngStyle]="partStyle(layer, 'red-towers')">T{{ getScorebugTeam(layer, 'red').towers }}</span>
        }
        @if(layer.showGold) {
        <span class="team-gold" data-component-part="red-gold" [ngStyle]="partStyle(layer, 'red-gold')">{{ formatTeamGold(getScorebugTeam(layer, 'red').gold) }}</span>
        }
        <span class="team-lockup">
          <span class="team-code" data-component-part="red-code" [ngStyle]="partStyle(layer, 'red-code')">{{ layer.redTeamCode }}</span>
          <span class="team-seed" data-component-part="red-seed" [ngStyle]="partStyle(layer, 'red-seed')">{{ getScorebugTeam(layer, 'red').seed }}</span>
        </span>
        <span class="team-logo" data-component-part="red-logo" [ngStyle]="partStyle(layer, 'red-logo')">{{ getTeamLogoText(layer.redTeamCode) }}</span>
      </div>

      @if(layer.showObjectives) {
      <div class="objective-row objective-row-blue" data-component-part="blue-objectives" [ngStyle]="partStyle(layer, 'blue-objectives')">
        <span>DR {{ getScorebugTeam(layer, 'blue').dragons }}</span>
        <span>VG{{ getScorebugTeam(layer, 'blue').voidGrubs }}</span>
        <span>H {{ getScorebugTeam(layer, 'blue').riftHerald }}</span>
      </div>
      <div class="objective-row objective-row-red" data-component-part="red-objectives" [ngStyle]="partStyle(layer, 'red-objectives')">
        <span>VG{{ getScorebugTeam(layer, 'red').voidGrubs }}</span>
        <span>DR {{ getScorebugTeam(layer, 'red').dragons }}</span>
        <span>H {{ getScorebugTeam(layer, 'red').riftHerald }}</span>
      </div>
      }
    </div>
    }
    @case(LayerType.LolPlayerRoster) {
      <div class="player-roster" data-component-part="surface" [attr.data-team]="layer.team" [style.--roster-tracks]="rosterTracks(layer)" [class.player-roster-right]="layer.orientation === 'right'">
      @for(player of getRosterPlayers(layer); track player.role) {
      <div class="roster-row" data-component-part="row" [attr.data-player-role]="player.role" [ngStyle]="partStyle(layer, 'row')">
        @if(layer.orientation === 'right') {
        @if(layer.showKda) {
        <span class="roster-kda" data-component-part="kda" [ngStyle]="partStyle(layer, 'kda')">{{ getKda(player) }}</span>
        }

        @if(layer.showCs) {
        <span class="roster-stat" data-component-part="cs" [ngStyle]="partStyle(layer, 'cs')">{{ player.creepScore }}</span>
        }

        @if(layer.showGold) {
        <span class="roster-stat" data-component-part="gold" [ngStyle]="partStyle(layer, 'gold')">{{ formatPlayerGold(player.gold) }}</span>
        }

        <span class="roster-name" data-component-part="name" [ngStyle]="partStyle(layer, 'name')">{{ player.name }}</span>

        @if(layer.showLevel) {
        <span class="roster-level" data-component-part="level" [ngStyle]="partStyle(layer, 'level')">{{ player.level }}</span>
        }

        @if(layer.showChampion) {
        <span class="roster-portrait" data-component-part="portrait" [ngStyle]="partStyle(layer, 'portrait')">
          <span class="portrait-fallback">{{ getChampionFallback(player) }}</span>
          <img [src]="getChampionImage(player)" [alt]="player.championName" />
        </span>
        }

        @if(layer.showItems) {
        <span class="roster-items" data-component-part="items" [ngStyle]="partStyle(layer, 'items')">
          @for(item of player.items; track $index) {
          <span class="item-slot" data-component-part="item" [ngStyle]="partStyle(layer, 'item')">
            @if(item.id) {
            <img [src]="getItemImage(item)" [alt]="item.name" />
            }
          </span>
          }
        </span>
        }
        } @else {
        @if(layer.showItems) {
        <span class="roster-items" data-component-part="items" [ngStyle]="partStyle(layer, 'items')">
          @for(item of player.items; track $index) {
          <span class="item-slot" data-component-part="item" [ngStyle]="partStyle(layer, 'item')">
            @if(item.id) {
            <img [src]="getItemImage(item)" [alt]="item.name" />
            }
          </span>
          }
        </span>
        }

        @if(layer.showChampion) {
        <span class="roster-portrait" data-component-part="portrait" [ngStyle]="partStyle(layer, 'portrait')">
          <span class="portrait-fallback">{{ getChampionFallback(player) }}</span>
          <img [src]="getChampionImage(player)" [alt]="player.championName" />
        </span>
        }

        @if(layer.showLevel) {
        <span class="roster-level" data-component-part="level" [ngStyle]="partStyle(layer, 'level')">{{ player.level }}</span>
        }

        <span class="roster-name" data-component-part="name" [ngStyle]="partStyle(layer, 'name')">{{ player.name }}</span>

        @if(layer.showCs) {
        <span class="roster-stat" data-component-part="cs" [ngStyle]="partStyle(layer, 'cs')">{{ player.creepScore }}</span>
        }

        @if(layer.showGold) {
        <span class="roster-stat" data-component-part="gold" [ngStyle]="partStyle(layer, 'gold')">{{ formatPlayerGold(player.gold) }}</span>
        }

        @if(layer.showKda) {
        <span class="roster-kda" data-component-part="kda" [ngStyle]="partStyle(layer, 'kda')">{{ getKda(player) }}</span>
        }
        }
      </div>
      }
    </div>
    }
    @case(LayerType.PlayerItems) {
    <div class="items-layer">
      @for(item of getPlayerItemSlots(layer); track $index) {
      <span class="item-slot">
        @if(item.id) {
        <img [src]="getItemImage(item)" [alt]="item.name" />
        }
      </span>
      }
      @if(layer.showTrinket) {
      <span class="item-slot trinket-slot">
        @if(getPlayer(layer).trinket.id) {
        <img [src]="getItemImage(getPlayer(layer).trinket)" [alt]="getPlayer(layer).trinket.name" />
        }
      </span>
      }
    </div>
    }
    @case(LayerType.ChampionPortrait) {
    <div [class]="getPortraitClass(layer)">
      <span class="portrait-fallback">{{ getChampionFallback(getPlayer(layer)) }}</span>
      <img [src]="getChampionImage(getPlayer(layer))" [alt]="getPlayer(layer).championName" />
      @if(layer.showLevel) {
      <span class="portrait-level">{{ getPlayer(layer).level }}</span>
      }
    </div>
    }
    @default {
    <span class="stat-layer">{{ getPreviewText() }}</span>
    }
    }
  `,
  styles: [
    `
      :host {
        display: grid;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        place-items: stretch;
        overflow: hidden;
        color: inherit;
        container-type: inline-size;
      }

      .stat-layer {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
        overflow: hidden;
        color: inherit;
        font-size: clamp(9px, 9cqw, 34px);
        font-weight: 850;
        line-height: 1;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .scorebug {
        position: relative;
        display: grid;
        width: 100%;
        height: 100%;
        min-height: 0;
        grid-template:
          "blue center red" minmax(0, 1fr)
          "blue-objectives center red-objectives" 28% / minmax(0, 1fr) minmax(20%, 0.34fr) minmax(0, 1fr);
        overflow: hidden;
        background:
          linear-gradient(90deg, color-mix(in srgb, var(--blue-accent), transparent 12%), rgb(18 22 39 / 96%) 32%, rgb(18 22 39 / 96%) 68%, color-mix(in srgb, var(--red-accent), transparent 12%));
        color: inherit;
        font-family: Arial, sans-serif;
        text-transform: uppercase;
      }

      .scorebug-team,
      .scorebug-center,
      .objective-row {
        display: flex;
        align-items: center;
        min-width: 0;
      }

      .scorebug-team {
        gap: 4.8%;
        padding: 0 4.8%;
        background:
          linear-gradient(180deg, rgb(255 255 255 / 14%), transparent 46%),
          rgb(5 9 21 / 44%);
      }

      .scorebug-team-blue {
        grid-area: blue;
        justify-content: flex-start;
      }

      .scorebug-team-red {
        grid-area: red;
        justify-content: flex-end;
      }

      .team-logo {
        display: grid;
        flex: 0 0 auto;
        width: min(18cqw, 46px);
        aspect-ratio: 1;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 32%);
        background: rgb(255 255 255 / 14%);
        color: #ffffff;
        font-size: clamp(9px, 3.2cqw, 17px);
        font-weight: 950;
        line-height: 1;
        box-shadow: 0 6px 12px rgb(0 0 0 / 26%);
      }

      .scorebug-team-blue .team-logo {
        border-left: 3px solid var(--blue-accent);
      }

      .scorebug-team-red .team-logo {
        border-right: 3px solid var(--red-accent);
      }

      .team-lockup {
        display: grid;
        min-width: 0;
        gap: 0.12em;
      }

      .scorebug-team-red .team-lockup {
        text-align: right;
      }

      .team-code {
        overflow: hidden;
        font-size: clamp(12px, 6.2cqw, 34px);
        font-weight: 950;
        letter-spacing: 0;
        line-height: 1.1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .team-seed {
        overflow: hidden;
        color: rgb(255 255 255 / 78%);
        font-size: clamp(5px, 1.45cqw, 10px);
        font-weight: 850;
        line-height: 1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .team-gold {
        font-size: clamp(10px, 3.8cqw, 19px);
        font-weight: 950;
        opacity: 0.96;
        white-space: nowrap;
      }

      .team-objective {
        display: grid;
        min-width: 1.8em;
        place-items: center;
        color: rgb(255 255 255 / 88%);
        font-size: clamp(7px, 2.2cqw, 13px);
        font-weight: 950;
        line-height: 1;
        white-space: nowrap;
      }

      .scorebug-center {
        position: relative;
        grid-area: center;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: minmax(0, 1fr) auto;
        justify-items: center;
        gap: 0;
        background:
          linear-gradient(180deg, rgb(255 255 255 / 8%), transparent 38%),
          rgb(7 8 18 / 92%);
        box-shadow:
          1px 0 0 rgb(255 255 255 / 14%) inset,
          -1px 0 0 rgb(255 255 255 / 14%) inset;
      }

      .team-kills {
        min-width: 1.4em;
        text-align: center;
        font-size: clamp(15px, 8cqw, 40px);
        font-weight: 950;
      }

      .score-divider {
        display: none;
        width: 2px;
        height: 52%;
        background: rgb(255 255 255 / 24%);
      }

      .game-clock {
        position: static;
        grid-column: 1 / -1;
        min-width: 5.4em;
        padding: 0.18em 0.55em;
        border: 1px solid rgb(255 255 255 / 14%);
        background: rgb(2 3 8 / 78%);
        color: #fff;
        font-size: 1.5cqw;
        font-weight: 950;
        text-align: center;
        transform: none;
      }

      .objective-row {
        gap: 7%;
        padding: 0 5%;
        background: rgb(3 4 10 / 82%);
        color: rgb(255 255 255 / 78%);
        font-size: clamp(6px, 2cqw, 12px);
        font-weight: 900;
        opacity: 0.88;
      }

      .objective-row-blue {
        grid-area: blue-objectives;
        justify-content: flex-start;
      }

      .objective-row-red {
        grid-area: red-objectives;
        justify-content: flex-end;
      }

      .player-roster {
        display: grid;
        width: 100%;
        height: 100%;
        grid-template-rows: repeat(5, minmax(0, 1fr));
        gap: 2.4%;
        padding: 1.6%;
        overflow: hidden;
        background: rgb(8 10 16 / 68%);
        color: inherit;
        font-family: Arial, sans-serif;
      }

      .roster-row {
        display: grid;
        align-items: center;
        min-width: 0;
        min-height: 0;
        grid-template-columns: var(--roster-tracks);
        grid-template-rows: minmax(0, 1fr);
        gap: 1.5%;
        padding: 0.7% 1.4%;
        overflow: hidden;
        background: linear-gradient(90deg, rgb(255 255 255 / 10%), rgb(255 255 255 / 3%));
      }

      .player-roster-right .roster-row {
        direction: ltr;
      }

      .player-roster-right .roster-name,
      .player-roster-right .roster-kda,
      .player-roster-right .roster-stat,
      .player-roster-right .roster-items {
        direction: ltr;
      }

      .roster-portrait,
      .roster-level,
      .item-slot,
      .portrait-level {
        display: grid;
        place-items: center;
      }

      .roster-portrait {
        position: relative;
        width: 100%;
        height: 100%;
        min-width: 0;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 18%, rgb(255 255 255 / 16%), transparent 58%),
          rgb(12 16 26 / 94%);
      }

      .roster-portrait img,
      .champion-portrait img,
      .item-slot img {
        position: relative;
        z-index: 1;
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .roster-portrait img {
        object-fit: contain;
      }

      .portrait-fallback {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: rgb(255 255 255 / 76%);
        font-size: clamp(8px, 5cqw, 18px);
        font-weight: 950;
        line-height: 1;
      }

      .roster-level,
      .roster-stat,
      .roster-kda {
        font-size: 3cqw;
        font-weight: 850;
        white-space: nowrap;
      }

      .roster-name {
        overflow: hidden;
        font-size: 3.3cqw;
        font-weight: 880;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .roster-items,
      .items-layer {
        display: grid;
        min-width: 0;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 3px;
      }
      .roster-items { height: 100%; min-height: 0; align-items: center; }
      .roster-kda { font-size: 2.5cqw; }

      .items-layer {
        width: 100%;
        height: 100%;
        grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1fr);
        align-items: center;
      }

      .item-slot {
        aspect-ratio: 1;
        min-width: 0;
        max-height: 100%;
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 18%);
        background: rgb(0 0 0 / 34%);
      }

      .trinket-slot {
        border-color: rgb(113 209 255 / 58%);
      }

      .champion-portrait {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: rgb(7 8 14 / 88%);
      }

      .champion-portrait-circle {
        border-radius: 999px;
      }

      .champion-portrait-banner img {
        object-position: center 18%;
      }

      .portrait-level {
        position: absolute;
        right: 0;
        bottom: 0;
        min-width: 28%;
        height: 28%;
        background: rgb(0 0 0 / 78%);
        color: #fff;
        font-size: clamp(8px, 11cqw, 20px);
        font-weight: 950;
      }
    `,
  ],
})
export class StatLoaderComponent {
  @Input({ required: true }) layer!: StatLayer;
  @Input() selectedPartKey = '';
  readonly LayerType = LayerType;
  readonly previewData = LEAGUE_PREVIEW_DATA;

  /** Match the actual visible bound fields; styling can freely override this grid. */
  rosterTracks(layer: LolPlayerRosterLayer): string {
    return nativeRosterTracks(layer);
  }

  partStyle(layer: LolScorebugLayer | LolPlayerRosterLayer, key: string): Record<string, string | number> {
    const css = getComponentPartCss(layer.partStyles?.[key], layer.width || 1);
    return this.selectedPartKey === key ? {
      ...css,
      outline: '2px solid #edbd95',
      'outline-offset': '-2px',
    } : css;
  }

  getPreviewText() {
    switch (this.layer.type) {
      case LayerType.PlayerScore:
        return formatKda(getPreviewPlayer(this.layer.team, this.layer.role));
      case LayerType.PlayerCreepScore:
        return String(getPreviewPlayer(this.layer.team, this.layer.role).creepScore);
      case LayerType.PlayerGold:
        return formatGold(getPreviewPlayer(this.layer.team, this.layer.role).gold);
      case LayerType.PlayerName:
        return getPreviewPlayer(this.layer.team, this.layer.role).name;
      case LayerType.PlayerLevel:
        return String(getPreviewPlayer(this.layer.team, this.layer.role).level);
      case LayerType.ChampionName:
        return getPreviewPlayer(this.layer.team, this.layer.role).championName;
      case LayerType.TeamGold:
        return this.getTeamGold(this.layer.team);
      case LayerType.GoldDiff:
        return formatGoldDiff(getPreviewTeam('blue').gold, getPreviewTeam('red').gold);
      case LayerType.Time:
        return LEAGUE_PREVIEW_DATA.gameTime;
      default:
        return this.layer.name;
    }
  }

  getTeam(team: StatLayerTeam) {
    return getPreviewTeam(team);
  }

  getScorebugTeam(layer: LolScorebugLayer, team: StatLayerTeam) {
    return { ...getPreviewTeam(team), ...layer.teamStats?.[team] };
  }

  formatTeamGold(value: number) {
    return formatGold(value);
  }

  getTeamKills(team: StatLayerTeam) {
    return getPreviewTeam(team).kills;
  }

  getTeamGold(team: StatLayerTeam) {
    return formatGold(getPreviewTeam(team).gold);
  }

  getPlayer(layer: Extract<StatLayer, { team: StatLayerTeam; role: string }>) {
    return getPreviewPlayer(layer.team, layer.role as LeaguePreviewPlayer['role']);
  }

  getKda(player: LeaguePreviewPlayer) {
    return formatKda(player);
  }

  formatPlayerGold(value: number) {
    return formatGold(value);
  }

  getChampionImage(player: LeaguePreviewPlayer) {
    return player.championImageUrl || getChampionImageUrl(player.championId);
  }

  getItemImage(item: LeaguePreviewItem) {
    return item.id ? getItemImageUrl(item.id) : '';
  }

  getTeamLogoText(teamCode: string) {
    return String(teamCode || '?').trim().slice(0, 2).toUpperCase();
  }

  getChampionFallback(player: LeaguePreviewPlayer) {
    return String(player.championName || player.name || '?').trim().slice(0, 2).toUpperCase();
  }

  getPlayerItemSlots(layer: PlayerItemsLayer) {
    return this.getPlayer(layer).items;
  }

  getRosterPlayers(layer: LolPlayerRosterLayer) {
    return LOL_ROLE_OPTIONS.map((role) => {
      const player = getPreviewPlayer(layer.team, role.value);
      const override = layer.playerOverrides?.[role.value];
      return {
        ...player,
        ...override,
        items: override?.items
          ? override.items.slice(0, 6).map((id) => ({ id, name: id ? `Item ${id}` : 'Empty' }))
          : player.items,
      };
    }).filter((player) => player.visible !== false);
  }

  getPortraitClass(layer: ChampionPortraitLayer) {
    return `champion-portrait champion-portrait-${layer.shape || 'square'}`;
  }
}
