<?php

namespace app\api\controller;

class Bdpay extends Common
{
    //支付回调
    public function baiduPayBack() {
        $data = $this->request->param(false);
        $res = \utils\Baidu::sign($data);
        if ($res) {
            db()->startTrans();
            //更新订单
            $order_info = db('order')->where("sn", $data['tpOrderId'])->find();
            if ($order_info['status'] == 0) {
                $ud['pay_time']    = time();
                $ud['status'] = 1;
                db('order')->where('order_id', $data['attach'])->update($ud);
            }

            db()->commit();

            $member_info = db('member')->where('mid',$order_info['mid'])->find();
            $teacher_info = db('teacher')->where('teacher_id',$order_info['teacher_id'])->find();

            if($teacher_info['mail']){
                $title = '家长购买老师课程';
                $address = [$teacher_info['mail']];
                $content = "        手机号为 ".$member_info['mobile']." 的家长,购买了编号为 ".$teacher_info['teacher_id']." 的老师课程";
                sendMail($title, $address,$content);
            }

            echo '{
                   "errno": 0,
                   "msg": "success",
                   "data": {
                       "isConsumed": 2
                   }
               }';
        } else {
            $res = "验签失败";
            file_put_contents("baidupayNotify.txt", print_r($res, true), FILE_APPEND);
        }
    }


    //支付回调
    public function baiduPayTcBack()
    {
        $data = $this->request->param(false);
        if (!\utils\Baidu::sign($data)) {
            $res = "验签失败";
            file_put_contents("baidupayNotify.txt", print_r($res, true), FILE_APPEND);
            abort(config('my.error_log_code'), '签名错误');
        }

        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('tc_order')->where('sn',$data['tpOrderId'])->find();

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
        echo '{
                   "errno": 0,
                   "msg": "success",
                   "data": {
                       "isConsumed": 2
                   }
               }';
    }



    public function baiduPayFileDownloadOrderBack(){
        $data = $this->request->param(false);
        if (!\utils\Baidu::sign($data)) {
            $res = "验签失败";
            file_put_contents("baidupayNotify.txt", print_r($res, true), FILE_APPEND);
            abort(config('my.error_log_code'), '签名错误');
        }

        //提交事务
        try {
            db()->startTrans();

            //订单详情
            $order_info = db('file_download_order')->where('sn',$data['tpOrderId'])->find();

            // log::info('微信支付回调数据：' . print_r($order, true));
            if ($order_info['status'] == 0) {
                $ud['pay_time']    = time();
                $ud['status'] = 1;
                db('file_download_order')->where('file_download_order_id', $data['attach'])->update($ud);


                //查询文件 资料
                $file_download_info = db('file_download')->where('file_download_id', $order_info['file_download_id'])->find();

                //添加购买记录
                $ins['file_download_id'] = $file_download_info['file_download_id'];
                $ins['name'] = $file_download_info['name'];
                $ins['file'] = $file_download_info['file'];
                $ins['mid'] = $order_info['mid'];
                $ins['create_time'] = time();
                db('my_file')->insert($ins);


                if($file_download_info['mid']){
                    //给上传资料的老师 添加消息通知
                    $ins['title'] = '购买资料通知';
                    $ins['content'] = "有用户购买了您的 ".$file_download_info['name']." 资料,请联系客服";
                    $ins['mid'] = $file_download_info['mid'];
                    $ins['create_time'] = time();
                    $ins['type'] = 2;
                    db('msg')->insertGetId($ins);
                }

            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }
        echo '{
                   "errno": 0,
                   "msg": "success",
                   "data": {
                       "isConsumed": 2
                   }
               }';
    }

}
