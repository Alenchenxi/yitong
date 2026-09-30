<?php

namespace app\cms\controller;
use app\cms\service\BaseService;

class Order extends Base
{
    /**
     * @api {post} /order/createOrder  01、创建订单
     * @apiGroup 订单
     * @apiVersion 1.0.0
     * @apiDescription  创建订单
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (传入参数：) {number}      demand_id   需求id
     */
    public function createOrder(){
        if(!$this->mid){
            return json(['status' => 404, 'msg' => '登陆超时']);
        }

        $demand_id = $this->request->param('demand_id', '', 'intval');
        if(!$demand_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        //查询 该用户 老师信息
        $teacher_info = db('teacher')->where('mid', $this->mid)->find();
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
            return json(['status' => 404, 'msg' => '对不起,没有找该学员信息']);
        }

        //如果该需求已有老师确认
        if($demand_info['teacher_id']){
            return json(['status' => 406, 'msg' => '此订单已聘请好合适的教员']);
        }

        //查询该老师 有没有购买过该学生的信息
        $has = db('teacher_stu')->where('mid', $this->mid)->where('demand_id', $demand_id)->where('status', 1)->find();
        //$has = db('order')->where('mid', $this->mid)->where('demand_id', $demand_id)->where('status', '>=', 1)->find();
        if($has){
            return json(['status' => 404, 'msg' => '您已查看过该订单,不需要再次购买']);
        }


        //查看是否有未支付订单
        $has_wzf_order = db('order')->where('mid', $this->mid)->where('demand_id', $demand_id)->where('status',0)->where('type', 1)->find();

        if($has_wzf_order['staus']==1){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单']);
        }

        if($has_wzf_order['staus']==2){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单,正在申请退款']);
        }

        if($has_wzf_order['staus']==3){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单,并已退款']);
        }

        if($has_wzf_order['staus']==4){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单,并已完成']);
        }

        //查询 学科收取的费用
        $subject_info = db('subject')->where('subject_id', $demand_info['subject_id'])->find();

        //计算 老师需要交的费用  课程单价 * 中介小时费 * 老师折扣
        $amount = ($subject_info['price']*$subject_info['hours'])*($teacher_info['discount']/100);

        $ins['sn'] = doOrderSn(00);
        $ins['mid'] = $this->mid;
        $ins['demand_id'] = $demand_id;
        $ins['teacher_id'] = $teacher_info['teacher_id'];
        $ins['amount'] = $amount;
        $ins['create_time'] = time();

        //如果有未支付订单
        if($has_wzf_order && $has_wzf_order['status']==0){
            //修改原待支付订单
            db('order')->where('order_id', $has_wzf_order['order_id'])->update($ins);
            $order_id = $has_wzf_order['order_id'];
        }else{
            //创建订单
            $order_id = db('order')->insertGetId($ins);
        }

        if($ins['amount']>0){
            $total_fee  = $ins['amount']*100;
            //$total_fee  = 1;
            $notify_url = request()->domain().'/wxpay/wxpayBack';;
            $payInfo = [
                'body' => '订单支付', //交易的标题 自己定义
                'out_trade_no' => $ins['sn'], //交易订单号
                // 'total_fee'    => 1, //交易金额 单位 分
                'total_fee' => $total_fee, //交易金额 单位 分
                'notify_url' => $notify_url, //支付回调地址
                'attach' => $order_id, //原样传回的数据
            ];
            try {
                $config = array_merge(config('my.official_accounts'), config('my.wechart_pay'));
                $res = \utils\wechart\PayService::h5Pay($payInfo, $config);
            } catch (\Exception $e) {
                //throw new ValidateException($e->getMessage());
                var_dump($e->getMessage());
            }
            $url =  $res['mweb_url'] . "&redirect_url=http%3A%2F%2Fquanyi.aipingyi.cn/login/redirect";

            return json(['status' => 200, 'data' => $url]);
        }

        $ud['pay_time']    = time();
        $ud['status'] = 1;
        db('order')->where('order_id', $order_id)->update($ud);

        $ins['mid'] = $this->mid;
        $ins['teacher_id'] =  $teacher_info['teacher_id'];
        $ins['demand_id'] = $demand_id;
        $ins['create_time'] = time();
        db('teacher_stu')->insert($ins);
        return json(['status' => 205, 'data' => '购买成功']);
    }




    /**
     * @api {post} /order/createTcOrder  02、创建套餐订单
     * @apiGroup 订单
     * @apiVersion 1.0.0
     * @apiDescription  创建套餐订单
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (传入参数：) {number}      set_meal_id   套餐id
     */
    public function createTcOrder(){
        if(!$this->mid){
            return json(['status' => 404, 'msg' => '登陆超时']);
        }

        $set_meal_id = $this->request->param('set_meal_id', '', 'intval');
        if(!$set_meal_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        //查询 该用户 老师信息
        $teacher_info = db('teacher')->where('mid', $this->mid)->find();
        if(!$teacher_info){
            return json(['status' => 404, 'msg' => '对不起,没有找到您的老师信息']);
        }

        //查询套餐信息
        $set_meal_info = db('set_meal')->where('set_meal_id', $set_meal_id)->find();
        if(!$set_meal_info){
            return json(['status' => 404, 'msg' => '对不起,没有找到该查询套餐信息']);
        }


        $ins['sn'] = doOrderSn(00);
        $ins['mid'] = $this->mid;
        $ins['teacher_id'] = $teacher_info['teacher_id'];
        $ins['set_meal_id'] = $set_meal_info['set_meal_id'];
        $ins['amount'] = $set_meal_info['price'];
        $ins['create_time'] = time();

        //创建订单
        $order_id = db('tc_order')->insertGetId($ins);

        $total_fee  = $ins['amount']*100;
        //$total_fee  = 1;
        $notify_url = request()->domain().'/wxpay/wxpayTcBack'; //支付回调地址
        $payInfo = [
            'body' => '置顶套餐支付', //交易的标题 自己定义
            'out_trade_no' => $ins['sn'], //交易订单号
            'total_fee' => $total_fee, //交易金额 单位 分
            'notify_url' => $notify_url, //支付回调地址
            'attach' => $order_id, //原样传回的数据
        ];
        try {
            $config = array_merge(config('my.official_accounts'), config('my.wechart_pay'));
            $res = \utils\wechart\PayService::h5Pay($payInfo, $config);
        } catch (\Exception $e) {
            //throw new ValidateException($e->getMessage());
            var_dump($e->getMessage());
        }
        $url =  $res['mweb_url'] . "&redirect_url=http%3A%2F%2Fquanyi.aipingyi.cn/login/redirect";
        return json(['status' => 200, 'data' => $url]);
    }




    /**
     * @api {post} /order/wxPay  03、微信支付
     * @apiGroup 订单
     * @apiVersion 1.0.0
     * @apiDescription  微信支付
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (传入参数：) {number}      order_id 订单id
     */
    public function wxPay(){
        if(!$this->mid){
            return json(['status' => 404, 'msg' => '登陆超时']);
        }

        $order_id = $this->request->param('order_id', '', 'intval');

        if(!$order_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        //获取订单信息
        $order_info = db('order')->find($order_id);
        if(!$order_info){
            return json(['status' => 404, 'msg' => '没有找到该订单信息']);
        }

        if($order_info['staus']==1){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单']);
        }

        if($order_info['staus']==2){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单,正在申请退款']);
        }

        if($order_info['staus']==3){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单,并已退款']);
        }

        if($order_info['staus']==4){
            return json(['status' => 404, 'msg' => '您已支付过该需求订单,并已完成']);
        }


        //查询学生信息
        $demand_info = db('demand')->where('demand_id', $order_info['demand_id'])->find();
        if(!$demand_info){
            return json(['status' => 404, 'msg' => '对不起,没有找该学员信息']);
        }
        //如果该需求已有老师确认
        if($demand_info['teacher_id']){
            return json(['status' => 406, 'msg' => '此订单已聘请好合适的教员']);
        }

        //后台设置每单最多可抢人数  order_grab_max
        $order_grab_max = config("config.order_grab_max");
        //查询 有几个老师查看过该学生信息
        $qry_num = db('teacher_stu')->alias('a')
            ->field('GROUP_CONCAT(b.name) as teacher_names,count(a.teacher_stu_id) as qry_num')
            ->join('teacher b','a.teacher_id=b.teacher_id','left')
            ->where('a.demand_id', $order_info['demand_id'])->where('a.status',1)->select()->toArray();

        if($qry_num['qry_num']>=$order_grab_max){
            return json(['status' => 405, 'msg' => "此订单已有 ".$qry_num['teacher_names']." 与家长接洽沟通中"]);
        }


        if($order_info['amount']>0){
            $total_fee  = $order_info['amount']*100;
            //$total_fee  = 1;
            $openid     = db("member")->where("mid", $this->mid)->value('openid');
            $notify_url = request()->domain().'/wxpay/wxpayBack'; //支付回调地址
            $payInfo    = [
                'body'         => '联系学员订单支付', //交易的标题 自己定义
                'out_trade_no' => $order_info['sn'], //交易订单号
                'total_fee'    => $total_fee, //交易金额 单位 分
                'notify_url'   => $notify_url,
                'openid'       => $openid,
                'attach'       => $order_id,
            ];
            try {
                $config = array_merge(config('my.mini_program'), config('my.wechart_pay'));
                $res    = \utils\wechart\PayService::jsapiPay($payInfo, $config);
            } catch (\Exception $e) {
                throw new ValidateException($e->getMessage());
            }
            $res['timeStamp'] = $res['timestamp'];
            return json(['status' => 200, 'data' => $res]);
        }

        $ud['pay_time']    = time();
        $ud['status'] = 1;
        db('order')->where('order_id', $order_info['order_id'])->update($ud);

        return json(['status' => 200, 'data' => '购买成功']);
    }



    /**
     * @api {post} /order/createBackOnlineOrder  05、创建重新上线支付订单
     * @apiGroup 订单
     * @apiVersion 1.0.0
     * @apiDescription  创建重新上线支付订单
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (传入参数：) {number}      teacher_id	   老师id
     */
    public function createBackOnlineOrder(){
        if(!$this->mid){
            return json(['status' => 404, 'msg' => '登陆超时']);
        }

        //查询 该用户 老师信息
        $teacher_info = db('teacher')->where('mid', $this->mid)->find();
        if(!$teacher_info){
            return json(['status' => 404, 'msg' => '对不起,没有找到您的老师信息']);
        }

        //后台设置重新上线的价格
        $back_online_price = config("config.back_online_price");

        $ins['sn'] = doOrderSn(00);
        $ins['mid'] = $this->mid;
        $ins['teacher_id'] = $teacher_info['teacher_id'];
        $ins['amount'] = $back_online_price;
        $ins['create_time'] = time();

        //创建订单
        $order_id = db('back_online_order')->insertGetId($ins);

        if($back_online_price>0){
            $total_fee  = $back_online_price*100;
            //$total_fee  = 1;
            $openid     = db("member")->where("mid", $this->mid)->value('openid');
            $notify_url = request()->domain().'/wxpay/backOrderWxpayBack'; //支付回调地址
            $payInfo = [
                'body' => '置顶套餐支付', //交易的标题 自己定义
                'out_trade_no' => $ins['sn'], //交易订单号
                'total_fee' => $total_fee, //交易金额 单位 分
                'notify_url' => $notify_url, //支付回调地址
                'attach' => $order_id, //原样传回的数据
            ];
            try {
                $config = array_merge(config('my.official_accounts'), config('my.wechart_pay'));
                $res = \utils\wechart\PayService::h5Pay($payInfo, $config);
            } catch (\Exception $e) {
                //throw new ValidateException($e->getMessage());
                var_dump($e->getMessage());
            }
            $url =  $res['mweb_url'] . "&redirect_url=http%3A%2F%2Fquanyi.aipingyi.cn/login/redirect";
            return json(['status' => 200, 'data' => $url]);
        }

        $ud['pay_time']    = time();
        $ud['status'] = 1;
        db('back_online_order')->where('back_online_order_id', $order_id)->update($ud);

        //重新上线
        db('teacher')->where('teacher_id',$teacher_info['teacher_id'])->update(['is_on_off'=>1]);
        return json(['status' => 200, 'data' => '购买成功']);
    }



}
