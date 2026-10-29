import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { initials } from '../../utils';

const AVATAR_COLORS = ['#3657f5', '#7c4dff', '#0e8f6a', '#c2410c', '#be185d', '#0369a1', '#6d28d9', '#047857'];

@Component({
  selector: 'k2-avatar',
  imports: [MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  readonly name = input<string | null>(null);
  readonly size = input(32);
  readonly tooltip = input(false);
  readonly text = computed(() => (this.name() ? initials(this.name()) : '—'));
  readonly color = computed(() => {
    const n = this.name();
    if (!n) return '#9aa1b9';
    let hash = 0;
    for (const ch of n) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  });
}
