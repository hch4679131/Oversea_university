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
    purpose ENUM('register', 'reset_password', 'login') NOT NULL COMMENT '用途',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_expires (phone, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='验证码表';
