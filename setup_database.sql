-- 创建数据库
CREATE DATABASE IF NOT EXISTS hksd_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE hksd_auth;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL COMMENT '手机号（唯一登录凭证）',
    password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密后的密码',
    id_card VARCHAR(18) COMMENT '身份证号',
    id_card_name VARCHAR(50) COMMENT '身份证姓名',
    verified BOOLEAN DEFAULT FALSE COMMENT '是否通过身份证实名验证',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

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
    user_id BIGINT NOT NULL COMMENT '代理账号ID（映射 agent_users.id）',
    order_no VARCHAR(64) NOT NULL UNIQUE COMMENT '订单号',
    title VARCHAR(255) NOT NULL COMMENT '订单标题/备注',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '金额',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/cancelled/etc',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='代理订单表';

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
