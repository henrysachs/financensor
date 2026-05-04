import type { Member } from '@/lib/api'

export function AssignmentEditor({
  members,
  assignedTo,
  onChange,
}: {
  members: Member[]
  assignedTo: string[]
  onChange: (assignedTo: string[]) => void
}) {
  const toggleAllAssigned = () => {
    if (assignedTo.length === members.length) {
      onChange([])
      return
    }
    onChange(members.map((member) => member.id))
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Zuteilung</p>
        <button
          type="button"
          onClick={toggleAllAssigned}
          className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {assignedTo.length === members.length ? 'Keine' : 'Alle'}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <label key={member.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
            <input
              type="checkbox"
              checked={assignedTo.includes(member.id)}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange([...assignedTo, member.id])
                  return
                }
                onChange(assignedTo.filter((id) => id !== member.id))
              }}
              className="h-4 w-4 rounded"
            />
            <span className="truncate">{member.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
