<?php

namespace app\api\controller;

use app\admin\service\DemandViewRecordService;
use app\admin\service\MemberService;
use think\exception\ValidateException;
use think\facade\Log;

class Demand extends Common
{
    /**
     * @api {post} /demand/refreshDemand 1、 刷新需求
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  刷新需求
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      demand_id 需求id
     */
    public function refreshDemand()
    {
        if (!request()->uid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $demand_id = $this->request->param('demand_id', '', 'intval');

        $demand_info = db("demand")->where('demand_id',$demand_id)->where('mid', request()->uid)->find();

        if(!$demand_info){
            return json(['status' => 404, 'msg' => '没有找到您的该需求信息']);
        }

        $day_ref_info = db('day_refresh')->where('demand_id', $demand_info['demand_id'])->where('date', date('Y-m-d'))->find();
        if($day_ref_info){
            return json(['status' => 404, 'msg' => '您今日已刷新,不能再次刷新']);
        }

        db("demand")->where('demand_id', $demand_info['demand_id'])->update(['create_time'=>time()]);

        $ins['date'] = date('Y-m-d');
        $ins['mid'] = request()->uid;
        $ins['demand_id'] = $demand_info['demand_id'];
        //添加 今日刷新记录
        db('day_refresh')->insert($ins);

        return json(['status' => 200, 'msg' => '刷新成功']);
    }


    /**
     * @api {post} /demand/hideOrShowDemand 2、 隐藏/显示需求
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  隐藏/显示需求
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      demand_id 需求id
     */
    public function hideOrShowDemand()
    {
        if (!request()->uid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $demand_id = $this->request->param('demand_id', '', 'intval');

        $demand_info = db("demand")->where('demand_id',$demand_id)->where('mid', request()->uid)->find();

        if(!$demand_info){
            return json(['status' => 404, 'msg' => '没有找到您的该需求信息']);
        }

        if($demand_info['is_hide']==1){
            $is_hide=0;
            $msg = '显示';
        }else{
            $is_hide=1;
            $msg = '隐藏';
        }

        db("demand")->where('demand_id', $demand_info['demand_id'])->update(['is_hide'=>$is_hide]);

        return json(['status' => 200, 'msg' => $msg.'成功']);
    }



    /**
     * @api {post} /demand/confirmFinish 3、 确认完成
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  确认完成
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      demand_id 需求id
     * @apiParam (输入参数：) {number}      order_id  老师联系订单id
     */
    public function confirmFinish()
    {
        if (!request()->uid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $demand_id = $this->request->param('demand_id', '', 'intval');
        $order_id = $this->request->param('order_id', '', 'intval');
        $demand_info = db("demand")->where('demand_id',$demand_id)->where('mid', request()->uid)->find();

        if(!$demand_info){
            return json(['status' => 404, 'msg' => '没有找到您的该需求信息']);
        }

        $order_info = db("order")->where('order_id', $order_id)->find();

        if($order_info['demand_id'] != $demand_id){
            return json(['status' => 404, 'msg' => '该订单与需求信息不匹配']);
        }

        //修改需求
        db('demand')->where('demand_id', $demand_id)->update(['status'=>2,'teacher_id'=>$order_info['teacher_id']]);

        //修改订单状态   已完成
        db('order')->where('order_id', $order_id)->update(['status'=>1]);

        return json(['status' => 200, 'msg' => '操作成功']);
    }



    /**
     * @api {post} /demand/getDemandOrderList 4、 获取老师联系需求列表
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  获取老师联系需求列表
     * @apiParam (输入参数：) {number}      demand_id 需求id
     */
    public function getDemandOrderList()
    {

        $demand_id = $this->request->param('demand_id', '', 'intval');
        $demand_info = db("demand")->where('demand_id',$demand_id)->find();

        if(!$demand_info){
            return json(['status' => 404, 'msg' => '没有找到您的该需求信息']);
        }

        /*$list = db("order")->alias('a')
            ->field('a.order_id,a.status as order_status,b.*,c.nickname,c.avatar,c.login_time,d.name as subject_name,a.type')
            ->join('demand b','a.demand_id=b.demand_id','left')
            ->join('member c','b.mid=c.mid','left')
            ->join('subject d','b.subject_id=d.subject_id','left')
            ->where('a.demand_id',$demand_id)
            ->order('a.create_time desc')
            ->select()->toArray();*/

        $list = db("order")->alias('a')
            ->field('a.order_id,a.status as order_status,a.type,b.*,c.avatar')
            ->join('teacher b','a.teacher_id=b.teacher_id','left')
            ->join('member c','a.mid=c.mid','left')
            ->where('a.demand_id',$demand_id)
            ->order('a.create_time desc')
            ->select()->toArray();

        foreach ($list as $k => $v) {

            if(!$list[$k]['head_img']){
                $list[$k]['head_img'] = $list[$k]['avatar'];
            }


            $list[$k]['area'] = implode(' ',array_slice(explode(',',$list[$k]['area']),0,3));


            $list[$k]['name'] = getShortName($list[$k]['name']);
            $list[$k]['login_time'] = time_tran($list[$k]['login_time']);

            $subject_id = explode(',',$v['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $list[$k]['subject_names'] = db('subject')->where($where1)->limit(3)->select()->toArray();
        }


        return json(['status' => 200, 'data' => $list]);
    }



    /**
     * @api {post} /demand/contactDemand 5、 老师联系需求添加记录
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  老师联系需求添加记录
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      demand_id 需求id
     */
    public function contactDemand()
    {
        if (!request()->uid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $demand_id = $this->request->param('demand_id', '', 'intval');
        if(!$demand_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        //查询 该用户 老师信息
        $teacher_info = db('teacher')->where('mid', request()->uid)->find();
        if(!$teacher_info){
            return json(['status' => 404, 'msg' => '对不起,没有找到您的老师信息']);
        }

        if($teacher_info['status'] != 1){
            return json(['status' => 404, 'msg' => '对不起,您的审核状态不为已通过状态,无法查看学员信息']);
        }

        if($teacher_info['is_on_off'] != 1){
            return json(['status' => 404, 'msg' => '对不起,您的简历状态为下线状态,无法查看学员信息']);
        }

        //查询学生信息
        $demand_info = db('demand')->where('demand_id', $demand_id)->find();
        if(!$demand_info){
            return json(['status' => 404, 'msg' => '对不起,没有找到该学员信息']);
        }

        //如果该需求已有老师确认
        if($demand_info['teacher_id']){
            return json(['status' => 406, 'msg' => '此订单已聘请好合适的教员']);
        }

        //查询该老师 有没有购买过该学生的信息
        $has = db('order')->where('mid', request()->uid)->where('demand_id', $demand_id)->find();
        if($has){
            return json(['status' => 200, 'msg' => '添加成功']);
        }


        $ins['sn'] = doOrderSn(00);
        $ins['mid'] = request()->uid;
        $ins['demand_id'] = $demand_id;
        $ins['teacher_id'] = $teacher_info['teacher_id'];
        $ins['create_time'] = time();
        $ins['status'] = 0;
        $order_id = db('order')->insertGetId($ins);

        return json(['status' => 200,  'msg' => '添加成功']);
    }






    /**
     * @api {post} /demand/contactTeacher 6、 联系老师
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  联系老师
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      teacher_id  老师id
     * @apiParam (输入参数：) {string}      city  当前城市
     */
    public function contactTeacher()
    {
        if (!request()->uid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $teacher_id = $this->request->param('teacher_id', '', 'intval');
        $city = $this->request->param('city', '', '');
        if(!$teacher_id || !$city){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $area_set = db('area')->where("name like '$city'")->find();

        if(!$area_set['is_direct_contact']==1){
            //是否可直接联系  is_direct_contact 是|1|primary,否|0|success

            //当前城市  不可直接联系  查看当前用户有没有 已支付未完成的需求订单
            //status   待支付|0|success,已支付|1|primary,已完成|2|danger
            $has = db('demand')->where('mid', request()->uid)->where('status', 1)->find();

            if(!$has){
                return json(['status' => 404, 'msg' => '请先发布需求']);
            }

        }

        return json(['status' => 200,  'msg' => '可直接联系']);
    }




    /**
     * @api {post} /demand/applyRefundDemand 6、 需求订单申请退款
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  需求订单申请退款
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      demand_id 需求id
     */
    public function applyRefundDemand()
    {
        if (!request()->uid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $demand_id = $this->request->param('demand_id', '', 'intval');
        if(!$demand_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }


        //查询学生信息
        $demand_info = db('demand')->where('demand_id', $demand_id)->where('mid', request()->uid)->find();
        if(!$demand_info){
            return json(['status' => 404, 'msg' => '对不起,没有找到您的该需求信息']);
        }

        //is_real_pay 是否真实支付  是|1|primary,否|0|success
        if($demand_info['is_real_pay']!=1){
            return json(['status' => 406, 'msg' => '该需求订单为直接发布订单,不能申请退款']);
        }

        //is_refund 是否退款  是|1|primary,否|0|success
        if($demand_info['is_refund']!=0){
            return json(['status' => 406, 'msg' => '该需求订单已退款']);
        }
        
        //status  待支付|0|success,已支付|1|primary,已完成|2|info,申请退款|3|danger
        if($demand_info['status']!=1){
            return json(['status' => 406, 'msg' => '该需求订单不为已支付状态,不能申请退款']);
        }

        //修改状态为申请退款
        db('demand')->where('demand_id', $demand_id)->update(['status'=>3]);

        return json(['status' => 200,  'msg' => '申请成功']);
    }

    /**
     * @api {post} /demand/getUserDemandHistoryPage 7、 获取用户需求浏览记录分页列表
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  获取用户需求浏览记录分页列表
     * @apiHeader {String} Authorization 用户授权token
     */
    public function getUserDemandHistoryPage(){
        $mid = request()->uid;
        $pageNum = $this->request->param('pageNum', 1, 'intval');
        $pageSize = $this->request->param('pageSize', 6, 'intval');
        $data = [];
        if(!$mid){
            $data['hasSession'] = false;
            $data['list'] = [];
            return json(['status' => 200, 'data' => $data]);
        }
        $where[] = ['mid', '=', $mid];
        $time = time() - 30 * 24 * 60 * 60;
        $where[] = ['view_time', '>=', $time];
        $data = DemandViewRecordService::getUserDemandHistoryPage($where, $pageNum, $pageSize);
        return json(['status' => 200, 'data' => $data]);
    }

    /**
     * @api {post} /demand/getDemandTeacherViewHistory 8、 获取用户需求老师浏览记录列表
     * @apiGroup 需求管理
     * @apiVersion 1.0.0
     * @apiDescription  获取用户需求浏览记录列表
     * @apiHeader {String} Authorization 用户授权token
     */
    public function getDemandTeacherViewHistory(){
        $mid = request()->uid;
        $pageNum = $this->request->param('pageNum', 1, 'intval');
        $pageSize = $this->request->param('pageSize', 6, 'intval');
        $demand_id = $this->request->param('demand_id', '', 'intval');
        if(!$demand_id){
            return json(['status' => 901, 'msg' => '参数不完整']);
        }
        if(!$mid){
            return json(['status' => 401, 'msg' => '请先登录']);
        }
        $demand_info = db('demand')->where('demand_id', $demand_id)->find();
        if(!$demand_info || $demand_info['mid'] != $mid){
            return json(['status' => 500, 'msg' => '信息不存在或已删除']);
        }
        $data = [];
        if(!$mid){
            $data['hasSession'] = false;
            $data['list'] = [];
            return json(['status' => 200, 'data' => $data]);
        }
        //time 30天以内
        $time = time() - 30 * 24 * 60 * 60;
        $where[] = ['demand_id', '=', $demand_id];
        $where[] = ['view_time', '>=', $time];
        $data = DemandViewRecordService::getDemandTeacherViewHistory($where, $pageNum, $pageSize);
        return json(['status' => 200, 'data' => $data]);
    }
}
