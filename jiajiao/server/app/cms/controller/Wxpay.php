<?php

namespace app\cms\controller;

class Wxpay extends Base
{
    //支付回调
    public function wxpayBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (!\utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('order')->where('order_id',$data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time']    = time();
                $ud['status'] = 1;
                db('order')->where('order_id', $data['attach'])->update($ud);

                //添加购买记录
                $ins['mid'] = $order_info['mid'];
                $ins['teacher_id'] = $order_info['teacher_id'];
                $ins['demand_id'] = $order_info['demand_id'];
                $ins['create_time'] = time();
                db('teacher_stu')->insert($ins);

                //如果有预约信息 删除
                db('appointment')->where('teacher_id',$order_info['teacher_id'])->where('demand_id',$order_info['demand_id'])->delete();

            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }


    //backOrderWxpayBack  重新上线支付回调
    public function backOrderWxpayBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (!\utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('back_online_order')->where('back_online_order_id',$data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time']    = time();
                $ud['status'] = 1;
                db('back_online_order')->where('back_online_order_id', $data['attach'])->update($ud);

                //将参与订单 下线运算的 订单 标记
                db('order')->where('mid', $order_info['mid'])->where('is_operation', 0)->update(['is_operation'=>1]);
                //重新上线
                db('teacher')->where('teacher_id',$order_info['teacher_id'])->update(['is_on_off'=>1]);

            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }


    //支付回调
    public function wxpayTcBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (!\utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('tc_order')->where('tc_order_id',$data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time']    = time();
                $ud['status'] = 1;
                db('tc_order')->where('tc_order_id', $data['attach'])->update($ud);

                //查询套餐信息
                $set_meal_info = db('set_meal')->where('set_meal_id', $order_info['set_meal_id'])->find();
                //计算总置顶天数
                $total_stick_days = $set_meal_info['stick_days']+$set_meal_info['give_days'];

                //修改老师的置顶时间
                $teacher_info = db('teacher')->where('teacher_id', $order_info['teacher_id'])->find();
                //如果置顶结束时间 >= 当前时间  则追加 没有 则修改
                if($teacher_info['stick_exp_time']>=time()){
                    $stick_exp_time = $teacher_info['stick_exp_time']+($total_stick_days*86400);
                }else{
                    $stick_exp_time = time()+($total_stick_days*86400);
                }
                db('teacher')->where('teacher_id',$order_info['teacher_id'])->update(['stick_time'=>time(),'stick_exp_time'=>$stick_exp_time]);
            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }


}
