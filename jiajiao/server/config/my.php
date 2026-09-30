<?php
// +----------------------------------------------------------------------
// | ThinkPHP [ WE CAN DO IT JUST THINK ]
// +----------------------------------------------------------------------
// | Copyright (c) 2006~2018 http://thinkphp.cn All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( http://www.apache.org/licenses/LICENSE-2.0 )
// +----------------------------------------------------------------------
// | Author: liu21st <liu21st@gmail.com>
// +----------------------------------------------------------------------

// +----------------------------------------------------------------------
// | 自定义配置
// +----------------------------------------------------------------------
return [

    'config_module_id'        => 41,                                                                                                                                                                                                                                                   //系统配置业务模块ID  配置单独生成 不清楚勿动
    'max_dump_data'           => 50000,                                                                                                                                                                                                                                                //excel最大导出数据量
    'upload_dir'              => './uploads',                                                                                                                                                                                                                                          //文件上传根目录
    'upload_subdir'           => 'Ym',                                                                                                                                                                                                                                                 //文件上传二级目录 标准的日期格式
    'nocheck'                 => ['admin/Login/verify', 'admin/Login/index', 'admin/Index/index', 'admin/Index/main', 'admin/Login/out', 'admin/Upload/editorUpload', 'admin/Upload/uploadImages', 'admin/Upload/uploadUeditor', 'admin/Login/captcha', 'admin/Login/aliOssCallBack'], //不需要验证权限的url
    'img_show_status'         => true,                                                                                                                                                                                                                                                 //图片输入框 鼠标移动上去 是否显示图片 true 显示 false 不显示
    'error_log_code'          => 500,                                                                                                                                                                                                                                                  //写入日志的状态码

    'export_per_num'          => 50,    //excel每次导入的数据量 建议不要高于200
    'import_type'             => 'xls', //可选格式有 xls、xlsx、csv

    'password_secrect'        => 'xhadmin', //密码加密秘钥

                                        //api基本配置
    'api_input_log'           => true,  //api参数输入记录日志(全局)
    'successCode'             => '200', //成功返回码
    'errorCode'               => '201', //错误返回码
    'jwtExpireCode'           => '101', //jwt过期
    'jwtErrorCode'            => '102', //jwt无效

                                                                          //聚合短信配置
    'juhe_sms_key'            => '3420d7egshdjhshjdsh77776767c373f4b4ac', //key
    'juhe_sms_tempCode'       => '11205725',                              //短信验证码模板

                                                     //极速短信配置
    'jisu_sms_key'            => '', //key
    'jisu_sms_tempCode'       => '20492',            //短信验证码模板

                                                                   //阿里云短信配置
    'ali_sms_accessKeyId'     => '',       //阿里云短信 keyId
    'ali_sms_accessKeySecret' => '', //阿里云短信 keysecret
    'ali_sms_signname'        => '献新家教',                   //签名
    'ali_sms_tempCode'        => 'SMS_461290092',                  //短信模板 Code

                                           //oss开启状态 以及配置指定oss
    'oss_status'              => false,    //true启用  false 不启用
    'oss_upload_type'         => 'server', //client 客户端直传  server 服务端传
    'oss_default_type'        => 'ali',    //oss使用类别 则使用ali的oss  qiniuyun 则使用七牛云oss

                                                                   //阿里云oss配置
    'ali_oss_accessKeyId'     => '',           //阿里云短信 keyId
    'ali_oss_accessKeySecret' => '', //阿里云短信 keysecret
    'ali_oss_endpoint'        => 'http://i.whpj.vip',              //建议填写自己绑定的域名
    'ali_oss_bucket'          => 'xhadmin',                        //阿里bucket

                                                                             //七牛云oss配置
    'qny_oss_accessKey'       => '',    //access_key
    'qny_oss_secretKey'       => '', //secret_key
    'qny_oss_bucket'          => 'xhadmin',                                  //bucket
    'qny_oss_domain'          => 'http://images.whpj.vip',                   //

                                                     //jwt鉴权配置
    'jwt_expire_time'         => 2626560,            //token过期时间 默认2小时
    'jwt_secrect'             => 'boTCfOGKwqTNKArT', //签名秘钥
    'jwt_iss'                 => 'client.xhadmin',   //发送端
    'jwt_aud'                 => 'server.xhadmin',   //接收端

                                                    //api上传配置
    'api_upload_domain'       => '',                //如果做本地存储 请解析一个域名到/public/upload目录  也可以不解析
    'api_upload_ext'          => 'jpg,png,gif,mp4', //api允许上传文件
    'api_upload_max'          => 200 * 1024 * 1024, //默认2M

    //小程序配置
    'mini_program'            => [
        /*'app_id' => 'wxbe911db2d5c1ac31', //小程序appid
        'secret' => '711289460b333a0a04430eda5af9175b', //小程序secret*/

        'app_id' => 'wx360d1d10e789017a',               //小程序appid
        'secret' => '12e9df9c9ad534fe5fe6f1da12ee16dd', //小程序secret
    ],

    //公众号配置
    'official_accounts'       => [
        'app_id' => 'wxa2c835664852',        //公众号appid
        'secret' => '2d7ef1db70dccd9e5e744', //公众号secret
        'token'  => 'chengdie',
    ],

    //抖音小程序配置
    'dy_mini_program'         => [
        'app_id'       => 'ttec679ada735b18df01',                     //抖音appid
        'secret'       => '12a81669305d5ff8518f1f21bacc7c9c611e5e89', //抖音secret
        'payment_salt' => '2d7ef1db70dccd9e5e744',                    //抖音支付密钥
        'token'        => '2d7ef1db70dccd9e5e744',                    //抖音支付token
    ],

    //百度小程序
    'baidu'                   => [
        'dealId'    => '29266111',
        'appKey'    => 'OacH8BWYnx2axKMVl2gOkIySd6burky8',
        'appSecret' => 'hlMkAmgLlDjWm3z8fh2M5RGrgaowUZnH',
    ],

    'pay_display'             => 1,

    //微信支付配置
    'wechart_pay'             => [
        'mch_id'              => '1717142388',                                                            //商户号
        'key'                 => 'd6EcLsvRn7HcPXsfvv5VZdvtLuxBmjrJ',                                      //微信支付32位秘钥
        'cert_path'           => app()->getRootPath() . 'extend/utils/wechart/zcerts/apiclient_cert.pem', //证书路径
        'key_path'            => app()->getRootPath() . 'extend/utils/wechart/zcerts/apiclient_key.pem',  //证书路径
        'rsa_public_key_path' => app()->getRootPath() . 'extend/utils/wechart/zcerts/public.pem',         //rsa公钥
    ],

    'upload_hash_status'      => true,  //检测是否存在已上传的图片并返回原来的图片路径 true 检测 false 不检测  默认为true如果不设置
    'filed_name_status'       => false, //true 设置字段时自动读取拼音作为字段名
    'reset_button_status'     => false, //列表搜索重置按钮状态 true开启 false关闭 需要重新生成
    'api_upload_auth'         => true,  //api应用上传是否验证token  true 验证 false不验证 需要重新生成

    //文件注释
    'comment'                 => [
        'api_comment'  => true, //api接口详细注释 true生成 false不生成
        'file_comment' => true, //文件头部注释  true生成 false不生成
        'author'       => '',
        'contact'      => '',
    ],

];
