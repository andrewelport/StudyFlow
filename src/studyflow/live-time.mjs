import {localDate, toMin, toClock} from './util.mjs';

export function livePosition(rows, date, now = new Date()) {
  if (date !== localDate(now)) return null;
  const minute = now.getHours() * 60 + now.getMinutes();
  const active = rows.filter(r => !r.cancelled && !r.done && (r.allDay || (toMin(r.start) <= minute && minute < toMin(r.end))));
  const next = rows.findIndex(r => !r.allDay && !r.cancelled && toMin(r.end) > minute);
  return {clock: toClock(minute), active, next};
}

// Update only the marker and highlighting: never replace forms or steal keyboard focus.
export function refreshLiveTime(root, now = new Date()) {
  for (const timeline of root.querySelectorAll('[data-live-date]')) {
    const nodes = [...timeline.querySelectorAll('[data-live-row]')];
    const rows = nodes.map(n => JSON.parse(n.dataset.liveRow));
    const position = livePosition(rows, timeline.dataset.liveDate, now);
    let marker = timeline.querySelector('[data-now-marker]');
    nodes.forEach(n => n.classList.remove('is-current'));
    if (!position) { marker?.remove(); continue; }
    if (!marker) {
      marker = document.createElement('div'); marker.className = 'now-marker';
      marker.dataset.nowMarker = ''; marker.setAttribute('role', 'timer');
    }
    const titles = position.active.filter(r => r.type !== 'free').map(r => r.title);
    marker.textContent = `עכשיו ${position.clock} · ${titles.length ? titles.join(' + ') : 'זמן פנוי'}`;
    position.active.forEach(r => nodes[rows.indexOf(r)].classList.add('is-current'));
    if (position.next < 0) timeline.append(marker);
    else timeline.insertBefore(marker, nodes[position.next]);
  }
}
