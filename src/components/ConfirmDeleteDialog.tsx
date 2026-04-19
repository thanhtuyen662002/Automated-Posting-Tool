import React from 'react'
import { Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ConfirmDeleteDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title?: string
    description?: string
    itemName?: string
    loading?: boolean
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Xác nhận xóa?',
    description = 'Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn.',
    itemName,
    loading = false
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={onClose} 
            />
            <Card className="relative w-full max-w-sm border-none shadow-2xl bg-surface-container-lowest rounded-[2rem] p-8 overflow-hidden animate-in zoom-in-95 fade-in duration-300 border-t-4 border-red-500">
                <div className="space-y-6 text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Trash2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-display font-bold text-foreground">
                            {title}
                        </h3>
                        {itemName && (
                            <p className="text-sm font-bold text-red-500 px-2 py-1 bg-red-50 rounded-lg inline-block">
                                {itemName}
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground pt-1">
                            {description}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                        <Button 
                            variant="ghost" 
                            className="flex-1 h-12 rounded-xl" 
                            onClick={onClose}
                            disabled={loading}
                        >
                            Hủy bỏ
                        </Button>
                        <Button 
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl font-bold shadow-lg shadow-red-500/20" 
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Xóa ngay'
                            )}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}
