/**
 * 卡密详情弹窗组件（批量数据卡券专用）
 *
 * 功能：
 * 1. 未售/已售 Tab 切换（未售来自 data_content，已售来自 xy_card_stock）
 * 2. 卡号/密码/订单/账号 模糊搜索
 * 3. 分页展示
 * 4. 导出 txt（一行一条「卡号 密码」）
 * 5. 批量删除（未售按整行内容，已售按记录ID）
 */
import { useCallback, useEffect, useState } from 'react'
import { X, Search, Download, Trash2, CheckSquare, Square, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import {
  getCardStock,
  batchDeleteCardStock,
  type CardData,
  type CardStockItem,
} from '@/api/cards'
import { useUIStore } from '@/store/uiStore'
import { ConfirmModal } from '@/components/common/ConfirmModal'

interface CardStockDetailProps {
  card: CardData
  onClose: () => void
  /** 删除后回调（用于刷新外层列表的剩余条数） */
  onChanged?: () => void
  zIndex?: number
}

type Tab = 'unsold' | 'sold'

const PAGE_SIZE = 20

export function CardStockDetail({ card, onClose, onChanged, zIndex = 60 }: CardStockDetailProps) {
  const { addToast } = useUIStore()
  const cardId = card.id as number

  const [tab, setTab] = useState<Tab>('unsold')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<CardStockItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [unsoldTotal, setUnsoldTotal] = useState(0)
  const [soldTotal, setSoldTotal] = useState(0)
  const [selected, setSelected] = useState<Map<string, CardStockItem>>(new Map())
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showExportConfirm, setShowExportConfirm] = useState(false)
  const [deleteAfterExport, setDeleteAfterExport] = useState(true)

  // 选中项的 key：未售用 content（整行内容），已售用 id
  const keyOf = (item: CardStockItem): string =>
    item.status === 'sold' && item.id != null ? `id:${item.id}` : `c:${item.content}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCardStock(cardId, { tab, search, page, page_size: PAGE_SIZE })
      setList(res.list || [])
      setTotal(res.total || 0)
      setTotalPages(res.total_pages || 0)
      setUnsoldTotal(res.unsold_total || 0)
      setSoldTotal(res.sold_total || 0)
    } catch {
      addToast({ type: 'error', message: '加载卡密明细失败' })
    } finally {
      setLoading(false)
    }
  }, [cardId, tab, search, page, addToast])

  useEffect(() => {
    load()
  }, [load])

  // 切换 Tab / 搜索时重置选择（翻页时保留勾选，支持跨页累计导出/删除）
  useEffect(() => {
    setSelected(new Map())
  }, [tab, search])

  const switchTab = (next: Tab) => {
    if (next === tab) return
    setTab(next)
    setPage(1)
    setSearch('')
    setSearchInput('')
  }

  const doSearch = () => {
    setSearch(searchInput.trim())
    setPage(1)
  }

  const allChecked = list.length > 0 && list.every(it => selected.has(keyOf(it)))
  const toggleAll = () => {
    const next = new Map(selected)
    if (allChecked) {
      list.forEach(it => next.delete(keyOf(it)))
    } else {
      list.forEach(it => next.set(keyOf(it), it))
    }
    setSelected(next)
  }
  const toggleOne = (item: CardStockItem) => {
    const k = keyOf(item)
    const next = new Map(selected)
    if (next.has(k)) next.delete(k)
    else next.set(k, item)
    setSelected(next)
  }

  const handleExport = () => {
    if (selected.size === 0) {
      addToast({ type: 'warning', message: '请先勾选要导出的卡密' })
      return
    }
    setDeleteAfterExport(true)
    setShowExportConfirm(true)
  }

  const confirmExport = async () => {
    setExporting(true)
    try {
      const chosen = [...selected.values()]
      const text = chosen
        .map(it => it.content || `${it.card_no}${it.card_secret ? ' ' + it.card_secret : ''}`)
        .join('\n')
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `card_${cardId}_${tab}_${chosen.length}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      if (deleteAfterExport) {
        const soldIds = chosen
          .filter(it => it.status === 'sold' && it.id != null)
          .map(it => it.id as number)
        const unsoldContents = chosen
          .filter(it => it.status === 'unsold')
          .map(it => it.content)
        let removed = 0
        if (soldIds.length) {
          const res = await batchDeleteCardStock(cardId, { status: 'sold', ids: soldIds })
          removed += res.data?.removed ?? 0
        }
        if (unsoldContents.length) {
          const res = await batchDeleteCardStock(cardId, { status: 'unsold', contents: unsoldContents })
          removed += res.data?.removed ?? 0
        }
        addToast({ type: 'success', message: `已导出 ${chosen.length} 条，并删除 ${removed} 条卡密` })
        setSelected(new Map())
        if (page > 1) setPage(1)
        else load()
        onChanged?.()
      } else {
        addToast({ type: 'success', message: `已导出 ${chosen.length} 条卡密` })
      }
      setShowExportConfirm(false)
    } catch {
      addToast({ type: 'error', message: '导出失败' })
    } finally {
      setExporting(false)
    }
  }

  const handleBatchDelete = async () => {
    setDeleting(true)
    try {
      const chosen = [...selected.values()]
      let removed = 0
      if (tab === 'sold') {
        const ids = chosen.map(it => it.id).filter((i): i is number => i != null)
        const res = await batchDeleteCardStock(cardId, { status: 'sold', ids })
        removed = res.data?.removed ?? 0
      } else {
        const contents = chosen.map(it => it.content)
        const res = await batchDeleteCardStock(cardId, { status: 'unsold', contents })
        removed = res.data?.removed ?? 0
      }
      addToast({ type: 'success', message: `成功删除 ${removed} 条卡密` })
      setConfirmDelete(false)
      setSelected(new Map())
      if (page > 1) setPage(1)
      else load()
      onChanged?.()
    } catch {
      addToast({ type: 'error', message: '批量删除失败' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex }}>
      <div className="modal-content max-w-4xl max-h-[90vh] flex flex-col">
        <div className="modal-header flex items-center justify-between">
          <h2 className="text-lg font-semibold truncate">卡密详情 - {card.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="modal-body flex flex-col gap-3 overflow-hidden">
          {/* Tab 切换 */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => switchTab('unsold')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'unsold'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              未售 ({unsoldTotal})
            </button>
            <button
              onClick={() => switchTab('sold')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'sold'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              已售 ({soldTotal})
            </button>
          </div>

          {/* 工具栏：搜索 / 导出 / 批量删除 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
                placeholder={tab === 'sold' ? '搜索 卡号/密码/订单/账号' : '搜索 卡号/密码'}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={doSearch} className="btn-ios-secondary inline-flex items-center gap-1">
              <Search className="w-4 h-4" /> 搜索
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || selected.size === 0}
              className="btn-ios-secondary inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> 导出{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={selected.size === 0}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> 批量删除{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>

          {/* 表格 */}
          <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 w-10">
                    <button onClick={toggleAll} title="全选/取消">
                      {allChecked ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-gray-400" />}
                    </button>
                  </th>
                  <th className="px-3 py-2">卡号</th>
                  <th className="px-3 py-2">密码</th>
                  {tab === 'sold' ? (
                    <>
                      <th className="px-3 py-2">关联订单</th>
                      <th className="px-3 py-2">关联账号</th>
                      <th className="px-3 py-2">售出时间</th>
                    </>
                  ) : (
                    <th className="px-3 py-2">状态</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={tab === 'sold' ? 6 : 4} className="px-3 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin inline" /> 加载中...
                  </td></tr>
                ) : list.length === 0 ? (
                  <tr><td colSpan={tab === 'sold' ? 6 : 4} className="px-3 py-8 text-center text-gray-400">
                    {tab === 'sold' ? '暂无已售记录' : '暂无未售卡密'}
                  </td></tr>
                ) : (
                  list.map((item, idx) => {
                    const k = keyOf(item)
                    const checked = selected.has(k)
                    return (
                      <tr key={`${k}-${idx}`} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2">
                          <button onClick={() => toggleOne(item)}>
                            {checked ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-gray-400" />}
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono break-all max-w-[200px]">{item.card_no || '-'}</td>
                        <td className="px-3 py-2 font-mono break-all max-w-[200px]">{item.card_secret || '-'}</td>
                        {tab === 'sold' ? (
                          <>
                            <td className="px-3 py-2 break-all max-w-[160px]">{item.order_id || '-'}</td>
                            <td className="px-3 py-2 break-all max-w-[140px]">{item.account_id || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.sold_at ? new Date(item.sold_at).toLocaleString('zh-CN') : '-'}</td>
                          </>
                        ) : (
                          <td className="px-3 py-2"><span className="badge-warning">未售</span></td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>共 {total} 条</span>
            <div className="flex items-center gap-2">
              <span>第 {page} / {Math.max(totalPages, 1)} 页</span>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-ios-secondary">关闭</button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        type="danger"
        title="批量删除卡密"
        message={
          tab === 'sold'
            ? `确定删除选中的 ${selected.size} 条已售记录吗？仅删除明细记录，不影响订单。`
            : `确定删除选中的 ${selected.size} 条未售卡密吗？此操作不可恢复。`
        }
        loading={deleting}
        onConfirm={handleBatchDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      {showExportConfirm && (
        <div className="modal-overlay" style={{ zIndex: zIndex + 1 }}>
          <div className="modal-content max-w-md">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">导出卡密</h2>
              <button
                onClick={() => { if (!exporting) setShowExportConfirm(false) }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="modal-body flex flex-col gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                将导出选中的 <span className="font-semibold">{selected.size}</span> 条卡密为 txt（一行一条「卡号 密码」）。
              </p>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteAfterExport}
                  onChange={e => setDeleteAfterExport(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                导出后删除已导出的卡密（默认勾选，不可恢复）
              </label>
            </div>
            <div className="modal-footer flex justify-end gap-2">
              <button onClick={() => setShowExportConfirm(false)} disabled={exporting} className="btn-ios-secondary">取消</button>
              <button
                onClick={confirmExport}
                disabled={exporting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
              >
                {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 确认导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
