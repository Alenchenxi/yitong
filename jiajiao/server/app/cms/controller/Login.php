<?php


namespace app\cms\controller;


use app\admin\service\MemberService;
use think\exception\ValidateException;

class Login extends Base
{

    /**
     * 登录页面
     */
    public function index()
    {
        return view('index/login');
    }


    /**
     * @api {post} /login/mobileLogin 03、 手机号,验证码登陆
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  手机号,验证码登陆
     * @apiParam (输入参数：) {string}             mobile 手机号
     * @apiParam (输入参数：) {string}             verify  验证码
     */
    public function mobileLogin()
    {
        // * @apiParam (输入参数：) {string}

        $mobile = $this->request->param('mobile', '', '');
        $verify = $this->request->param('verify', '', '');
        if (!$mobile || !$verify) {
            return json(['status' => 404, 'msg' => "参数不完整"]);
        }


        $yz_code = db("sms")->where("mobile", $mobile)->order("id desc")->value("code");
        /*if ($yz_code != $verify) {
            return json(['status' => 404, 'msg' => "验证码不正确"]);
        }*/

        $res = db("member")->where('mobile', $mobile)->find();

        if (!$res) {

            $default_avatar = request()->domain().config('config.default_avatar');
            $default_nickName = substr_replace($mobile,'****',3,4);;

            $data['nickname']   = $default_nickName;
            $data['avatar']     = $default_avatar;
            $data['mobile']     = $mobile;
            $data['create_time'] = time();
            $data['status']     = 1;
            $mid = MemberService::add($data);
            $res = db("member")->where('mid',$mid)->find();
        }


        //教师信息
        $teacher_info = db('teacher')->where('mid',$res['mid'])->find();
        $subject_id = explode(',',$teacher_info['subject_id']);
        $where1 = [];
        $where1[] = ['subject_id','in',$subject_id];
        $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

        session('member_info', $res);
        session('teacher_info', $teacher_info);

        return json(['status' => 200, 'msg' => '登陆成功']);

    }

    /**
     * @api {post} /login/sendMobileCode 04、 发送手机验证码
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  获取手机号
     * @apiParam (输入参数：) {string}             mobile 手机号
     */
    public function sendMobileCode()
    {
        $mobile = $this->request->param('mobile', '', '');
        if (!$mobile) {
            return json(['status' => 404, 'msg' => "手机号不正确"]);
        }

        $t = db("sms")->where("mobile", $mobile)->order("id desc")->value("create_time");
        if (time() - $t < 120) {
            return json(['status' => 404, 'msg' => "操作过于频繁，请稍后重试"]);
        }
        //return json(['status' => 200, 'msg' => "发送成功"]);

        try{
            //发送验证码
            $code       = rand(100000, 999999);
            $param['mobile'] = $mobile;
            $param['code'] = $code;
            $param['TemplateCode'] = 'SMS_255265236';
            $res       = \utils\sms\AliSmsService::sendSms($param);

            //print_r($res);

            //发送成功
            if ($res['Code'] == 'OK') {
                $data['type']     = 1;
                $data['reason']     = $res['reason'];
                $data['mobile']     = $mobile;
                $data['code']       = $code;
                $data['create_time'] = time();
                db("sms")->insert($data);
                return json(['status' => 200, 'msg' => "发送成功"]);
            }
        }catch(\Exception $e){
            abort(config('my.error_log_code'),$e->getMessage());
        }

    }



    /**
     * @api {post} /login/verifyMobile 03、 验证手机号
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  验证手机号
     * @apiParam (输入参数：) {string}             mobile 手机号
     * @apiParam (输入参数：) {string}             verify  验证码
     */
    public function verifyMobile()
    {
        $mobile = $this->request->param('mobile', '', '');
        $verify = $this->request->param('verify', '', '');
        if (!$mobile || !$verify) {
            return json(['status' => 404, 'msg' => "参数不完整"]);
        }

        $yz_code = db("sms")->where("mobile", $mobile)->order("id desc")->value("code");
        if ($yz_code != $verify) {
            return json(['status' => 404, 'msg' => "验证码不正确"]);
        }

        return json(['status' => 200, 'msg' => "验证成功"]);

    }


    /**
     * 退出登录
     */
    public function out(){
        session('member_info', null);
        session('teacher_info', null);
        return json(['status' => 200, 'msg' => "退出成功"]);
    }


}