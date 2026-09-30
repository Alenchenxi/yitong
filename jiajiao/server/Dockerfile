FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/php:7.4.33-apache

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libzip-dev \
    libicu-dev \
    libonig-dev \
    libxml2-dev \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# 安装 PHP 扩展
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        gd \
        pdo_mysql \
        mysqli \
        zip \
        intl \
        mbstring \
        xml \
        opcache \
        bcmath \
        exif

# 启用 Apache mod_rewrite
RUN a2enmod rewrite

# 安装 Composer
COPY --from=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/composer:2 /usr/bin/composer /usr/bin/composer

# 设置工作目录
WORKDIR /var/www/html

# 复制项目文件
COPY . .

# 安装 Composer 依赖（生产环境，不安装 dev 包）
RUN composer install --no-dev --optimize-autoloader --no-interaction

# 设置目录权限
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 777 /var/www/html/runtime

# 复制 Apache 虚拟主机配置
COPY docker/apache/vhost.conf /etc/apache2/sites-available/000-default.conf

# 复制 PHP 配置
COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom.ini

EXPOSE 80
