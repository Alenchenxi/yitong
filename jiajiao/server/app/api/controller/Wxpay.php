<?php

namespace app\api\controller;

class Wxpay extends Common
{
    //支付回调
    public function wxpayBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('order')->where('order_id', $data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time'] = time();
                $ud['status']   = 1;
                db('order')->where('order_id', $data['attach'])->update($ud);

                /* //添加购买记录
                $ins['mid'] = $order_info['mid'];
                $ins['teacher_id'] = $order_info['teacher_id'];
                $ins['demand_id'] = $order_info['demand_id'];
                $ins['create_time'] = time();
                db('teacher_stu')->insert($ins);*/

                //如果有预约信息 删除
                //db('appointment')->where('teacher_id',$order_info['teacher_id'])->where('demand_id',$order_info['demand_id'])->delete();

            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }

        $member_info  = db('member')->where('mid', $order_info['mid'])->find();
        $teacher_info = db('teacher')->where('teacher_id', $order_info['teacher_id'])->find();

        if ($teacher_info['mail']) {
            $title   = '家长购买老师课程';
            $address = [$teacher_info['mail']];
            $content = "        手机号为 " . $member_info['mobile'] . " 的家长,购买了编号为 " . $teacher_info['teacher_id'] . " 的老师课程";
            sendMail($title, $address, $content);
        }

        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }

    //老师支付回调
    public function wxpayBack2()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();
            //订单详情
            $order_info = db('teacher_order')->where('teacher_order_id', $data['attach'])->find();
            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time'] = time();
                $ud['status']   = 1;
                db('teacher_order')->where('teacher_order_id', $data['attach'])->update($ud);

                $this->handleVip($order_info);
            }
            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }

    //支付预约订单回调
    public function wxPayAppointmentBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('appointment')->where('appointment_id', $data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 1) {
                $ud['pay_time'] = time();
                $ud['status']   = 2;
                db('appointment')->where('appointment_id', $data['attach'])->update($ud);
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

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('back_online_order')->where('back_online_order_id', $data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time'] = time();
                $ud['status']   = 1;
                db('back_online_order')->where('back_online_order_id', $data['attach'])->update($ud);

                //将参与订单 下线运算的 订单 标记
                db('order')->where('mid', $order_info['mid'])->where('is_operation', 0)->update(['is_operation' => 1]);
                //重新上线
                db('teacher')->where('teacher_id', $order_info['teacher_id'])->update(['is_on_off' => 1]);
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

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('tc_order')->where('tc_order_id', $data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time'] = time();
                $ud['status']   = 1;
                db('tc_order')->where('tc_order_id', $data['attach'])->update($ud);

                //查询套餐信息
                $set_meal_info = db('set_meal')->where('set_meal_id', $order_info['set_meal_id'])->find();
                //计算总置顶天数
                $total_stick_days = $set_meal_info['stick_days'] + $set_meal_info['give_days'];

                //修改老师的置顶时间
                $teacher_info = db('teacher')->where('teacher_id', $order_info['teacher_id'])->find();
                //如果置顶结束时间 >= 当前时间  则追加 没有 则修改
                if ($teacher_info['stick_exp_time'] >= time()) {
                    $stick_exp_time = $teacher_info['stick_exp_time'] + ($total_stick_days * 86400);
                } else {
                    $stick_exp_time = time() + ($total_stick_days * 86400);
                }
                db('teacher')->where('teacher_id', $order_info['teacher_id'])->update(['stick_time' => time(), 'stick_exp_time' => $stick_exp_time]);
            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }

    //支付回调
    public function demandWxPayBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $demand_info = db('demand')->where('demand_id', $data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($demand_info['status'] == 0) {
                $ud['is_real_pay'] = 1;
                $ud['status']      = 1;
                db('demand')->where('demand_id', $data['attach'])->update($ud);
            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }

    public function wxPayFileDownloadOrderBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('file_download_order')->where('file_download_order_id', $data['attach'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time'] = time();
                $ud['status']   = 1;
                db('file_download_order')->where('file_download_order_id', $data['attach'])->update($ud);

                //查询文件 资料
                $file_download_info = db('file_download')->where('file_download_id', $order_info['file_download_id'])->find();

                //添加购买记录
                $ins['file_download_id'] = $file_download_info['file_download_id'];
                $ins['name']             = $file_download_info['name'];
                $ins['file']             = $file_download_info['file'];
                $ins['mid']              = $order_info['mid'];
                $ins['create_time']      = time();
                db('my_file')->insert($ins);

                if ($file_download_info['mid']) {
                    //给上传资料的老师 添加消息通知
                    $ins['title']       = '购买资料通知';
                    $ins['content']     = "有用户购买了您的 " . $file_download_info['name'] . " 资料,请联系客服";
                    $ins['mid']         = $file_download_info['mid'];
                    $ins['create_time'] = time();
                    $ins['type']        = 2;
                    db('msg')->insertGetId($ins);
                }
            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }

    //支付回调
    public function dialOrderWxpayBack()
    {
        // log::info('微信支付回调数据：' . print_r($data, true));
        $xmldata = file_get_contents('php://input');
        $data    = (array) simplexml_load_string($xmldata, 'SimpleXMLElement', LIBXML_NOCDATA); //解析xml

        if (! \utils\wechart\NotifyService::checkSign($data)) {
            abort(config('my.error_log_code'), '签名错误');
        }
        // log::info('微信支付回调数据：' . print_r($data, true));
        //提交事务
        try {
            db()->startTrans();
            //订单详情
            $order_info = db('dial_order')->where('dial_order_id', $data['attach'])->find();
            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time'] = time();
                $ud['status']   = 1;
                db('dial_order')->where('dial_order_id', $data['attach'])->update($ud);
                //给用户添加次数
                $up['dial_num'] = $order_info['dial_num'];
                db('member')->where('mid', $order_info['mid'])->update($up);
            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }

    private function handleVip($order_info)
    {
        //20260317 开通VIP会员开始
        $now = time();
        $vip_info = db('member_vip')->where('mid', $order_info['mid'])->find();
        if ($vip_info) {
            // 已有记录：若eff_to已过期则重置eff_from为当前时间，eff_to从当前时间起算一个月
            if ($vip_info['eff_to'] < $now) {
                $new_eff_from = $now;
                $new_eff_to   = $this->addOneMonth($now);
                db('member_vip')
                    ->where('mid', $order_info['mid'])
                    ->where('id', $vip_info['id'])
                    ->update([
                        'eff_from'    => $new_eff_from,
                        'eff_to'      => $new_eff_to,
                        'update_time' => $now,
                    ]);
            } else {
                // eff_from未过期：在现有eff_to基础上追加一个月
                $new_eff_to = $this->addOneMonth($vip_info['eff_to']);
                db('member_vip')
                    ->where('mid', $order_info['mid'])
                    ->where('id', $vip_info['id'])
                    ->update([
                        'eff_to'      => $new_eff_to,
                        'update_time' => $now,
                    ]);
            }
        } else {
            // 无记录：新建VIP记录
            $eff_from   = $now;
            $eff_to     = $this->addOneMonth($eff_from);
            db('member_vip')->insert([
                'mid'         => $order_info['mid'],
                'teacher_id'  => $order_info['teacher_id'],
                'vip_level'   => 1,
                'eff_from'    => $eff_from,
                'eff_to'      => $eff_to,
                'create_time' => $now,
            ]);
        }
        //20260317 开通VIP会员截止        
    }
    /**
     * 追加一个月，若下个月没有对应日期则取下个月最后一天
     * 例：2027-01-31 + 1月 = 2027-02-28（而非溢出到03-03）
     */
    private function addOneMonth(int $timestamp): int
    {
        $d   = new \DateTime('@' . $timestamp);
        $d->setTimezone(new \DateTimeZone('Asia/Shanghai'));
        $day = (int) $d->format('j');
        $d->modify('+1 month');
        // 若日期溢出（如1月31日加一月变成3月3日），回退到上月最后一天
        if ((int) $d->format('j') < $day) {
            $d->modify('last day of last month');
        }
        return $d->getTimestamp();
    }
}
