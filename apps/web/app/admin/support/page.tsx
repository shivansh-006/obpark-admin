'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  LifeBuoy,
  Search,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  Send,
  User,
  ShoppingBag,
  Building,
  Tag,
  Paperclip,
  Check,
  ChevronRight,
  Shield,
  HelpCircle,
  Inbox,
} from 'lucide-react'

interface TicketMessage {
  id: string
  ticketId: string
  senderType: 'CUSTOMER' | 'ADMIN' | 'SUPPORT_AGENT' | 'SYSTEM'
  senderName?: string
  senderId?: string
  message: string
  attachments: string[]
  isInternalNote: boolean
  createdAt: string
}

interface SupportTicket {
  id: string
  ticketNumber: string
  subject: string
  category:
    | 'ORDER_INQUIRY'
    | 'DEFECTIVE_PRODUCT'
    | 'RETURN_REFUND'
    | 'PAYMENT_ISSUE'
    | 'FITMENT_COMPATIBILITY'
    | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status:
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'WAITING_ON_CUSTOMER'
    | 'RESOLVED'
    | 'CLOSED'
  customerId: string
  customer: {
    id: string
    firstName: string
    lastName: string
    email: string
    phoneNumber?: string
  }
  orderId?: string
  order?: {
    id: string
    orderNumber: string
    totalAmount: number
    status: string
  }
  vendorId?: string
  vendor?: {
    id: string
    businessName: string
    email: string
  }
  assignedTo?: string
  assignedUser?: {
    id: string
    name: string
    email: string
  }
  resolutionNote?: string
  resolvedAt?: string
  messages: TicketMessage[]
  createdAt: string
  updatedAt: string
}

interface TicketStats {
  open: number
  inProgress: number
  waitingOnCustomer: number
  urgent: number
  resolved: number
  total: number
}

export default function SupportDeskPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  // Reply composer state
  const [replyMessage, setReplyMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch KPI Stats
  const { data: stats } = useQuery<TicketStats>({
    queryKey: ['admin', 'tickets', 'stats'],
    queryFn: () => api.get('/admin/tickets/stats'),
    refetchInterval: 15000,
  })

  // Fetch Tickets List
  const { data: ticketsData, isLoading } = useQuery<{ tickets: SupportTicket[]; total: number }>({
    queryKey: ['admin', 'tickets', 'list', statusFilter, priorityFilter, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter)
      if (search.trim()) params.set('search', search.trim())
      params.set('limit', '50')
      return api.get(`/admin/tickets?${params.toString()}`)
    },
    refetchInterval: 10000,
  })

  // Fetch Selected Ticket Details
  const { data: selectedTicket } = useQuery<SupportTicket>({
    queryKey: ['admin', 'tickets', 'detail', selectedTicketId],
    queryFn: () => api.get(`/admin/tickets/${selectedTicketId}`),
    enabled: !!selectedTicketId,
  })

  // Mutation: Send Message / Note
  const sendMessageMutation = useMutation({
    mutationFn: ({
      ticketId,
      message,
      isInternal,
    }: {
      ticketId: string
      message: string
      isInternal: boolean
    }) =>
      api.post(`/admin/tickets/${ticketId}/messages`, {
        message,
        isInternalNote: isInternal,
        senderType: isInternal ? 'ADMIN' : 'SUPPORT_AGENT',
        senderName: 'Support Team',
      }),
    onSuccess: () => {
      setReplyMessage('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] })
      setFeedbackMsg({
        type: 'success',
        text: isInternalNote ? 'Internal note recorded.' : 'Reply sent to customer.',
      })
      setTimeout(() => setFeedbackMsg(null), 3000)
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to send message.' })
    },
  })

  // Mutation: Update Ticket (Status, Priority, Assignment)
  const updateTicketMutation = useMutation({
    mutationFn: ({
      ticketId,
      data,
    }: {
      ticketId: string
      data: { status?: string; priority?: string; resolutionNote?: string }
    }) => api.patch(`/admin/tickets/${ticketId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] })
      setFeedbackMsg({ type: 'success', text: 'Ticket updated successfully.' })
      setTimeout(() => setFeedbackMsg(null), 3000)
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to update ticket.' })
    },
  })

  const tickets = ticketsData?.tickets || []
  const activeTicket = selectedTicket || tickets.find((t) => t.id === selectedTicketId) || null

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTicket || !replyMessage.trim()) return
    sendMessageMutation.mutate({
      ticketId: activeTicket.id,
      message: replyMessage.trim(),
      isInternal: isInternalNote,
    })
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'WAITING_ON_CUSTOMER':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'CLOSED':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <LifeBuoy className="w-7 h-7 text-indigo-600" />
            Support Desk & Customer Ticketing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Resolve customer inquiries, order disputes, vendor fitment questions, and team notes.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats?.open ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Open Tickets</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-700">{stats?.urgent ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Urgent Priority</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats?.inProgress ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">In Progress</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats?.waitingOnCustomer ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Waiting Customer</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats?.resolved ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Resolved</div>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tickets Queue */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
          {/* Filters & Search */}
          <div className="p-4 border-b border-gray-200 space-y-3 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search ticket #, subject, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              {['ALL', 'OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {status === 'ALL' ? 'All' : status.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">No tickets match your filters</p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const isSelected = ticket.id === activeTicket?.id
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`p-4 cursor-pointer transition-all hover:bg-gray-50/80 ${
                      isSelected ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-semibold text-gray-500">
                        {ticket.ticketNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityBadge(
                            ticket.priority,
                          )}`}
                        >
                          {ticket.priority}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(
                            ticket.status,
                          )}`}
                        >
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-1">
                      {ticket.subject}
                    </h4>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1 truncate max-w-[180px]">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        {ticket.customer?.firstName} {ticket.customer?.lastName}
                      </span>
                      <span>
                        {new Date(ticket.updatedAt || ticket.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    {ticket.messages && ticket.messages.length > 0 && (
                      <p className="text-xs text-gray-400 line-clamp-1 mt-1 italic">
                        &quot;{ticket.messages[ticket.messages.length - 1].message}&quot;
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation & Resolution */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[750px] overflow-hidden">
          {activeTicket ? (
            <>
              {/* Active Ticket Header */}
              <div className="p-5 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {activeTicket.ticketNumber}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {activeTicket.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900">{activeTicket.subject}</h2>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {activeTicket.customer?.firstName} {activeTicket.customer?.lastName} (
                      {activeTicket.customer?.email})
                    </span>
                    {activeTicket.order && (
                      <span className="flex items-center gap-1 font-mono text-indigo-600">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Order #{activeTicket.order.orderNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status & Priority Controls */}
                <div className="flex items-center gap-2">
                  <select
                    value={activeTicket.priority}
                    onChange={(e) =>
                      updateTicketMutation.mutate({
                        ticketId: activeTicket.id,
                        data: { priority: e.target.value },
                      })
                    }
                    className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent</option>
                  </select>

                  <select
                    value={activeTicket.status}
                    onChange={(e) =>
                      updateTicketMutation.mutate({
                        ticketId: activeTicket.id,
                        data: { status: e.target.value },
                      })
                    }
                    className="text-xs font-semibold border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_ON_CUSTOMER">Waiting on Customer</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50 custom-scrollbar">
                {activeTicket.messages?.length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-400">
                    No messages in this ticket yet.
                  </div>
                ) : (
                  activeTicket.messages?.map((msg) => {
                    if (msg.isInternalNote) {
                      return (
                        <div
                          key={msg.id}
                          className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                              <Lock className="w-3.5 h-3.5 text-amber-700" />
                              Internal Staff Note &bull; {msg.senderName || 'Staff'}
                            </span>
                            <span className="text-[11px] text-amber-700">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-amber-950 whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      )
                    }

                    const isOutbound = msg.senderType === 'ADMIN' || msg.senderType === 'SUPPORT_AGENT'
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                            isOutbound
                              ? 'bg-indigo-600 text-white rounded-br-xs'
                              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-xs'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-between gap-4 mb-1 text-[11px] ${
                              isOutbound ? 'text-indigo-200' : 'text-gray-500'
                            }`}
                          >
                            <span className="font-semibold">{msg.senderName || msg.senderType}</span>
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Reply Box Composer */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
                {/* Note vs Public Toggle */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(false)}
                      className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
                        !isInternalNote
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Reply to Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternalNote(true)}
                      className={`text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-1 transition-colors ${
                        isInternalNote
                          ? 'bg-amber-100 text-amber-800'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      Internal Staff Note
                    </button>
                  </div>

                  {activeTicket.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateTicketMutation.mutate({
                          ticketId: activeTicket.id,
                          data: { status: 'RESOLVED', resolutionNote: 'Resolved by support team.' },
                        })
                      }
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark as Resolved
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder={
                      isInternalNote
                        ? 'Write a private note for staff members only...'
                        : 'Type your message to the customer...'
                    }
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className={`w-full p-3 text-xs border rounded-xl focus:outline-none transition-colors resize-none ${
                      isInternalNote
                        ? 'bg-amber-50/40 border-amber-300 focus:ring-1 focus:ring-amber-500'
                        : 'bg-white border-gray-200 focus:ring-1 focus:ring-indigo-500'
                    }`}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!replyMessage.trim() || sendMessageMutation.isPending}
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all shadow-sm disabled:opacity-50 ${
                        isInternalNote
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isInternalNote ? 'Save Internal Note' : 'Send Customer Reply'}
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
              <LifeBuoy className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-base font-semibold text-gray-700">No ticket selected</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Select a ticket from the left panel to inspect customer context, exchange messages, or record internal team notes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
