"""卡密库存/销售明细模型"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from common.db.base_class import Base


class CardStock(Base):
    """卡密库存/销售明细表

    逐条记录批量数据(data)卡券的卡密。当前实现以「已售」记录为主：
    发货消费一条卡密时写入一条 status='sold' 的记录，保留卡号/密码、
    关联订单、关联账号、售出时间，用于未售/已售明细查询、导出与批量删除。
    未售卡密仍保存在 xy_cards.data_content 中（发货消费逻辑不变）。
    """

    __tablename__ = "xy_card_stock"

    __table_args__ = (
        Index("idx_cs_card_id", "card_id"),
        Index("idx_cs_card_status", "card_id", "status"),
        Index("idx_cs_order_id", "order_id"),
        Index("idx_cs_card_no", "card_no"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    card_no: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment='卡号/账号')
    card_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment='卡密/密码')
    content: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True, comment='原始整行内容')
    status: Mapped[str] = mapped_column(String(16), nullable=False, default='sold', comment='unsold-未售 sold-已售')
    order_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment='关联订单ID')
    account_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, comment='关联账号(卖家cookie_id)')
    buyer_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, comment='买家ID')
    cost_price: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, comment='成本单价')
    channel: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment='发货渠道')
    sold_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment='售出时间')
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment='入库时间')
