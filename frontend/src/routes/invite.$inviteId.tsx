import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/invite/$inviteId')({
  beforeLoad: requireAuth,
  component: AcceptInvitePage,
})

function AcceptInvitePage() {
  const { inviteId } = Route.useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [groupName, setGroupName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    api.acceptInvite(inviteId)
      .then((result) => {
        setGroupId(result.groupId)
        setGroupName(result.groupName)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMsg(err.message)
        setStatus('error')
      })
  }, [inviteId])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Einladung wird angenommen...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-xl font-bold text-destructive">Einladung ungültig</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Zum Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="text-xl font-bold">Beigetreten!</h2>
        <p className="mt-2 text-muted-foreground">
          Du bist jetzt Mitglied von <strong>{groupName}</strong>.
        </p>
        <button
          onClick={() => navigate({ to: '/groups/$groupId', params: { groupId } })}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Zur Gruppe
        </button>
      </div>
    </div>
  )
}
