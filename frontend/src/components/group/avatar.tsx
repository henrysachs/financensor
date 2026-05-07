export function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-6 w-6 rounded-full" />
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
