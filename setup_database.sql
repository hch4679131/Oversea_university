-- 创建数据库
CREATE DATABASE IF NOT EXISTS hksd_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE hksd_auth;

-- 说明：当前部署未使用 users 表（普通用户体系）。
-- 如确认不再使用，可直接删除。
DROP TABLE IF EXISTS users;

-- 验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    code VARCHAR(6) NOT NULL COMMENT '6位验证码',
    purpose VARCHAR(40) NOT NULL COMMENT '用途（支持 register/reset_password/login/agent_login/agent_reset_password 等）',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_expires (phone, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='验证码表';

-- ==================== 代理系统（Agent） ====================

CREATE TABLE IF NOT EXISTS agent_users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号（代理账号唯一）',
    password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 密码',
    id_card VARCHAR(18) NULL COMMENT '身份证号（实名信息）',
    id_card_name VARCHAR(50) NULL COMMENT '身份证姓名（实名信息）',
    role VARCHAR(20) NOT NULL COMMENT 'admin/consultant/agent1/agent2/agent3/agent4',
    parent_id BIGINT NULL COMMENT '上级代理ID',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='代理账号表';

CREATE TABLE IF NOT EXISTS agent_orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '绑定账号ID（归属账号，映射 agent_users.id）',
    created_by_user_id BIGINT NULL COMMENT '创单账号ID（映射 agent_users.id）',
    order_no VARCHAR(16) NOT NULL UNIQUE COMMENT '订单号（8位：E/A + YY + MM + 3位序号）',
    title VARCHAR(32) NOT NULL COMMENT '服务名：EAC/AEC/EC/EA/AE/AC/E/A',
    amount DECIMAL(12,2) NOT NULL COMMENT '金额',
    status VARCHAR(20) NOT NULL DEFAULT '已创单' COMMENT '已创单/已签单/已完结',
    parent_name VARCHAR(50) NULL COMMENT '家长名字（可空）',
    parent_gender VARCHAR(10) NULL COMMENT '家长性别（可空）',
    parent_phone VARCHAR(20) NULL COMMENT '家长电话（可空）',
    student_name VARCHAR(50) NOT NULL COMMENT '学生名字（不可空）',
    student_gender VARCHAR(10) NOT NULL COMMENT '学生性别（不可空）',
    student_phone VARCHAR(20) NOT NULL COMMENT '学生电话（不可空）',
    extra_service_weight VARCHAR(10) NULL COMMENT '扩展服务权重排序（可空：ECA/EAC/CEA/CAE/AEC/ACE）',
    student_id_card VARCHAR(32) NULL COMMENT '学生身份证（可空）',
    signed_at TIMESTAMP NULL COMMENT '签单时间（可空）',
    finished_at TIMESTAMP NULL COMMENT '完结时间（可空）',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创单时间（自动获取）',
    INDEX idx_user (user_id),
    INDEX idx_created_by (created_by_user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='代理订单表';

CREATE TABLE IF NOT EXISTS agent_order_sequences (
    prefix CHAR(1) NOT NULL COMMENT 'E/A',
    yy CHAR(2) NOT NULL COMMENT '两位年份',
    mm CHAR(2) NOT NULL COMMENT '两位月份',
    seq INT NOT NULL COMMENT '序号',
    PRIMARY KEY (prefix, yy, mm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单号序号表（按 E/A + 月份独立计数）';

CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL COMMENT '代理账号ID',
    action VARCHAR(64) NOT NULL COMMENT '动作',
    detail TEXT NULL COMMENT '详细信息',
    ip VARCHAR(64) NULL COMMENT 'IP',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='代理日志表';

CREATE TABLE IF NOT EXISTS agent_config (
    k VARCHAR(100) PRIMARY KEY,
    v TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='代理配置表（备用）';

-- ==================== 种子数据（可选） ====================
-- 说明：以下为“实名信息”写入示例（身份证号/身份证姓名）。
-- 若你的线上环境 agent_users 已存在账号，可按 ID 定位后执行 UPDATE。
-- 注意：顾问账号目前可能不止 1 个，请先确认要写入哪一个。

-- 管理员（服务器当前为 id=1）
UPDATE agent_users
SET id_card = '44098219971021537X',
    id_card_name = CONVERT(UNHEX('e58d8ee8b685e685a7') USING utf8mb4) /* 华超慧 */
WHERE id = 1;

-- 顾问：二选一（服务器当前 consultant 有 2 个账号，请选择正确的那个）
-- UPDATE agent_users
-- SET id_card = '810000199710280062',
--     id_card_name = CONVERT(UNHEX('e9bb84e4b8bde4bbaa') USING utf8mb4) /* 黄丽仪 */
-- WHERE id = 2;

UPDATE agent_users
SET id_card = '810000199710280062',
    id_card_name = CONVERT(UNHEX('e9bb84e4b8bde4bbaa') USING utf8mb4) /* 黄丽仪 */
WHERE id = 3;

-- 1级代理（服务器当前为 id=4）
UPDATE agent_users
SET id_card = '430124200010264644',
    id_card_name = CONVERT(UNHEX('e9bb84e4bd91e4bbaa') USING utf8mb4) /* 黄佑仪 */
WHERE id = 4;
