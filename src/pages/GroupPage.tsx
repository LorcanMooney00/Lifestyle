import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  getGroup,
  getGroupMembers,
  removeGroupMember,
  updateGroup,
  deleteGroup,
  getPartners,
} from '../lib/api'
import type { Group, GroupMember } from '../types'
import { supabase } from '../lib/supabaseClient'

interface Partner {
  id: string
  email: string
  username: string
  profilePictureUrl?: string | null
}

export default function GroupPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { groupId } = useParams<{ groupId: string }>()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)

  const [partners, setPartners] = useState<Partner[]>([])
  const [isMemberMap, setIsMemberMap] = useState<Record<string, boolean>>({})
  const [updatingMembers, setUpdatingMembers] = useState<Record<string, boolean>>({})
  const [memberError, setMemberError] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user || !groupId) return
    loadGroup()
  }, [user, groupId])

  const loadGroup = async () => {
    if (!user || !groupId) return

    setLoading(true)
    setError(null)

    try {
      const [groupData, memberData, partnersData] = await Promise.all([
        getGroup(groupId),
        getGroupMembers(groupId),
        getPartners(user.id)
      ])

      if (!groupData) {
        setError('Group not found or you do not have access.')
        setGroup(null)
        setMembers([])
        setPartners([])
        return
      }

      setGroup(groupData)
      setGroupName(groupData.name)
      setGroupDescription(groupData.description || '')
      setMembers(memberData)
      setPartners(partnersData)

      const memberIds = new Set(memberData.map((member) => member.user_id))
      const membershipMap: Record<string, boolean> = {}
      partnersData.forEach((partner) => {
        membershipMap[partner.id] = memberIds.has(partner.id)
      })
      setIsMemberMap(membershipMap)
    } catch (err) {
      console.error(err)
      setError('Failed to load group data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const memberCount = useMemo(() => members.length, [members])
  const partnerLookup = useMemo(() => {
    const map = new Map<string, Partner>()
    partners.forEach((partner) => {
      map.set(partner.id, partner)
    })
    return map
  }, [partners])

  const handleSaveGroup = async () => {
    if (!group || !groupId || !groupName.trim()) return

    setSavingGroup(true)
    const success = await updateGroup(groupId, groupName.trim(), groupDescription.trim() || null)
    setSavingGroup(false)

    if (success) {
      setEditing(false)
      await loadGroup()
    } else {
      setError('Failed to update group details.')
    }
  }

  const handleTogglePartner = async (partner?: Partner) => {
    if (!groupId || !partner) return

    setMemberError(null)
    setUpdatingMembers((prev) => ({ ...prev, [partner.id]: true }))

    const currentlyMember = isMemberMap[partner.id]
    setIsMemberMap((prev) => ({ ...prev, [partner.id]: !currentlyMember }))
    let success = false

    if (currentlyMember) {
      success = await removeGroupMember(groupId, partner.id)
    } else {
      // Temporary: manually insert since addGroupMember expects email lookup
      // We'll add a new API helper later
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: partner.id,
          role: 'member',
        })

      success = !error
      if (error) {
        console.error('Error adding partner to group:', error)
      }
    }

    if (success) {
      await loadGroup()
    } else {
      setMemberError(`Failed to ${currentlyMember ? 'remove' : 'add'} partner. Please try again.`)
      setIsMemberMap((prev) => ({ ...prev, [partner.id]: currentlyMember }))
    }

    setUpdatingMembers((prev) => ({ ...prev, [partner.id]: false }))
  }

  const handleDeleteGroup = async () => {
    if (!groupId) return

    setDeleting(true)
    setDeleteError(null)

    const success = await deleteGroup(groupId)
    setDeleting(false)

    if (success) {
      navigate('/app/topics')
    } else {
      setDeleteError('Failed to delete group. Please try again.')
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <div className="w-10 h-10 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
          <p>Loading group...</p>
        </div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-4xl">🛑</div>
        <p className="text-lg text-slate-200">{error || 'Group not found.'}</p>
        <button
          onClick={() => navigate('/app/topics')}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app/topics')}
              className="text-slate-300 hover:text-white p-2 rounded-lg transition-all hover:bg-slate-700/50 active:scale-95"
              aria-label="Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <div>
              <p className="text-sm text-slate-400">Group</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{group.name}</h1>
            </div>
          </div>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 rounded-lg border border-red-500/60 text-red-300 hover:bg-red-500/10 transition-all text-sm font-medium"
          >
            Delete Group
          </button>
        </div>

        <div className="glass backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Members</p>
              <p className="text-3xl font-bold text-white">{memberCount}</p>
            </div>
            <div>
              <button
                onClick={() => setEditing((prev) => !prev)}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all"
              >
                {editing ? 'Cancel' : 'Edit Details'}
              </button>
            </div>
          </div>

          {editing ? (
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Group Name *</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-800/60 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-800/60 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-all"
                  disabled={savingGroup}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroup}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={savingGroup || !groupName.trim()}
                >
                  {savingGroup ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">Description</p>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">
                {group.description || 'Add a description to let members know what this group is for.'}
              </p>
            </div>
          )}
        </div>

        <div className="glass backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Partners</h2>
            <p className="text-sm text-slate-400">Toggle which partners are part of this group.</p>
          </div>

          {memberError && (
            <div className="rounded-lg border border-red-600/60 bg-red-900/20 text-red-200 text-sm px-3 py-2">
              {memberError}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {partners.length === 0 ? (
              <p className="text-sm text-slate-400">Link partners first to add them to this group.</p>
            ) : (
              partners.map((partner) => {
                const isMember = isMemberMap[partner.id]
                return (
                  <div
                    key={partner.id}
                    className={`rounded-xl border px-4 py-3 transition ${
                      isMember
                        ? 'border-indigo-500/50 bg-indigo-600/10'
                        : 'border-slate-700/60 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {partner.username || partner.email}
                        </p>
                        <p className="text-xs text-slate-400">{partner.email}</p>
                      </div>
                      <button
                        onClick={() => handleTogglePartner(partner)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          isMember
                            ? 'bg-red-600/90 text-white hover:bg-red-500'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        disabled={updatingMembers[partner.id]}
                      >
                        {updatingMembers[partner.id]
                          ? 'Updating...'
                          : isMember
                          ? 'Remove'
                          : 'Add'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="glass backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Members</h2>
              <p className="text-sm text-slate-400">
                Manage who has access to this group. Only the creator can add or remove members.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-sm text-slate-400">No members yet. Invite someone above.</p>
            ) : (
              members.map((member) => {
                const isYou = member.user_id === user.id
                return (
                  <div
                    key={member.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white flex items-center gap-2">
                        {isYou
                          ? 'You'
                          : partnerLookup.get(member.user_id)?.username ||
                            partnerLookup.get(member.user_id)?.email ||
                            'Unknown member'}
                        {isYou && (
                          <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {isYou
                          ? user.email || 'No email'
                          : partnerLookup.get(member.user_id)?.email || 'No email'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300 bg-slate-700/60 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        {member.role}
                      </span>
                      {!isYou && partnerLookup.get(member.user_id) && (
                        <button
                          onClick={() => handleTogglePartner(partnerLookup.get(member.user_id) as Partner)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-red-500/60 text-red-300 hover:bg-red-500/10 transition-all"
                          disabled={updatingMembers[member.user_id]}
                        >
                          {updatingMembers[member.user_id] ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass backdrop-blur-xl rounded-xl shadow-2xl w-full max-w-sm border border-red-600/50">
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Delete group?</h3>
                <p className="text-sm text-slate-300">
                  This will remove the group and all member links. Shared data (events, notes, etc.) will remain.
                </p>
              </div>

              {deleteError && (
                <div className="rounded-lg border border-red-600/60 bg-red-900/20 text-red-200 text-sm px-3 py-2">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-all"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteGroup}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

