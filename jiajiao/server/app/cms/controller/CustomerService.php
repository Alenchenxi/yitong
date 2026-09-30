<?php

namespace app\cms\controller;
use app\cms\service\BaseService;

class CustomerService extends Base
{
    /**
     *获取客服详情
     */
    public function index(){
        $qr_code = config('config.service_qr_code');
        $mobile = config('config.service_mobile');

        $service_info['qr_code'] = $qr_code;
        $service_info['mobile'] = $mobile;

        $this->view->assign('info', $service_info);
        $this->view->assign('nav', 4);
        return view('index/kefu');
    }




}
