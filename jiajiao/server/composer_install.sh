docker run --rm \
  -v $(pwd):/app \
  -w /app \
  -e COMPOSER_ALLOW_SUPERUSER=1 \
  swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/composer:2 \
  sh -c "
    # 1. 清除缓存
    composer clear-cache --no-interaction && \
    
    # 2. 配置阿里云镜像 (写入项目配置)
    composer config repos.packagist composer https://mirrors.aliyun.com/composer/ --no-interaction && \
    
    # 3. 允许插件
    composer config --no-plugins allow-plugins.easywechat-composer/easywechat-composer true --no-interaction && \
    
    # 4. 删除 lock 文件 (强制重新解析国内源的下载地址)
    #rm -f composer.lock && \
    
    # 5. 执行安装 
    #    --prefer-dist: 强制下载 zip (避免 git clone 卡死)
    #    --no-scripts: 跳过安装脚本 (防止脚本报错中断)
    #    --no-interaction: 非交互模式
    composer install --ignore-platform-reqs --prefer-dist --no-scripts --no-interaction -vvv && \
    
    # 6. 生成自动加载
    composer dump-autoload --no-interaction
  "