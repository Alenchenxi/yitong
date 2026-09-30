<?php

namespace app\cms\controller;
use app\cms\service\BaseService;

class News extends Base
{
    /**
     * 获取首页内容
     */
    public function index(){
        //获取当前选择的城市
        $content_id = $this->request->param('content_id', '', '');
        $info = db('content')->where('content_id', $content_id)->find();

        $info['create_time'] = date('Y-m-d H:i:s',$info['create_time']);
        $info['detail'] = format_html($info['detail']);
        $this->view->assign('info', $info);


        //添加已读
        $member_info = db('member')->where('mid', $this->mid)->find();
        if (strpos($member_info['is_read'], ',' . $content_id . ',') === false) {

            if (!$member_info['is_read']) {
                $str = ',' . $content_id . ',';
            } else {
                $str = $member_info['is_read'] . $content_id . ',';
            }

            db('member')->where('mid', $this->mid)->update(['is_read' => $str]);
        }

        return view('index/show');
    }




}
