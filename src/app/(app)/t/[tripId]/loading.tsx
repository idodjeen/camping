/**
 * What a trip screen shows the moment it is tapped, when it wasn't prefetched
 * (a slow network, or a link other than the tabs and the menu): the screen
 * switches at once and fills in when the server answers, instead of the old
 * screen sitting still. A prefetched screen skips this and opens on its content.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="טוען" className="space-y-3">
      <div className="mb-5 h-8 w-36 animate-pulse rounded-full bg-line" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="card h-[72px] animate-pulse" />
      ))}
    </div>
  );
}
