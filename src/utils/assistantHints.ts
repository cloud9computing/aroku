import { Species } from '../types';
import { TabType } from '../components/common/BottomNav';

// A short, rotating coaching example shown as the assistant input's own
// placeholder — tab-specific (it can do different things per tab) and
// species-aware (a pet's care looks different from a person's), so the hint
// disappears the moment someone starts typing instead of taking up its own
// row of screen space.
export function getAssistantPlaceholder(tab: TabType, species: Species): string {
  const isPet = species !== 'human';

  switch (tab) {
    case 'records':
      return isPet ? 'Try "schedule a deworming for next week"…' : 'Try "schedule an HbA1c test for Monday"…';
    case 'visits':
      return isPet ? 'Try "book a vet visit Tuesday at 5pm"…' : 'Try "appointment with Dr Rao Thursday 4pm"…';
    case 'medicines':
      return isPet ? 'Try "started Apoquel 16mg once a day"…' : 'Try "starting metformin 500mg after food"…';
    case 'doctors':
      return isPet ? "Ask about Bruno's vets, or say \"note for Dr X: …\"" : 'Ask about the care team, or say "note for Dr X: …"';
    default:
      return 'Ask, or tell me something new…';
  }
}
