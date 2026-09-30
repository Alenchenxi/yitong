<?php
namespace app\api\controller;

use app\admin\service\MemberService;
use think\exception\ValidateException;
use think\facade\Log;

class Login extends Common
{
    /**
     * @api {post} /Login/login 01、小程序登录
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  小程序登录

     * @apiParam (输入参数：) {string}             code 小程序传入
     * @apiParam (输入参数：) {string}             encryptedData 小程序传入
     * @apiParam (输入参数：) {string}             iv 小程序传入
     */
    public function login()
    {
        try {
            $post   = $this->request->param();
            $wxuser = \utils\wechart\UserService::getXcxUserInfo($post); //获取小程序用户信息
        } catch (\Exception $e) {
            throw new ValidateException($e->getMessage());
        }
        if (empty($wxuser)) {
            throw new ValidateException('小程序获取失败');
        }

        $res = db("member")->where('openid', $wxuser['openid'])->find();
        if (! $res) {
            if (! $wxuser['avatarUrl']) {
                $default_avatar = request()->domain() . config('config.default_avatar');
            } else {
                $default_avatar = $wxuser['avatarUrl'];
            }

            $data['openid']      = $wxuser['openid'];
            $data['nickname']    = $wxuser['nickName'];
            $data['avatar']      = $default_avatar;
            $data['create_time'] = time();
            $data['status']      = 1;
            MemberService::add($data);
            $res = db("member")->where('openid', $wxuser['openid'])->find();
        }

        //教师信息
        $teacher_info                  = db('teacher')->where('mid', $res['mid'])->find();
        $subject_id                    = explode(',', $teacher_info['subject_id']);
        $where1                        = [];
        $where1[]                      = ['subject_id', 'in', $subject_id];
        $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

        $data['token']        = $this->setToken($res['mid']);
        $data['user']         = $res;
        $data['teacher_info'] = $teacher_info;

        return json(['status' => 200, 'data' => $data]);

    }

    /**
     * @api {post} /login/mobile 02、手机号登陆
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  获取手机号
     * @apiParam (输入参数：) {string}             code 小程序传入
     * @apiParam (输入参数：) {string}             encryptedData 小程序传入
     * @apiParam (输入参数：) {string}             iv 小程序传入
     */
    public function mobile()
    {
        try {
            $post   = $this->request->param();
            $wxuser = \utils\wechart\UserService::getXcxUserInfo($post); //获取小程序用户信息
        } catch (\Exception $e) {
            throw new ValidateException($e->getMessage());
        }
        if (empty($wxuser)) {
            throw new ValidateException('小程序获取失败');
        }

        $res = db("member")->where('mobile', $wxuser['phoneNumber'])->find();
        if (! $res) {
            if (! $wxuser['avatarUrl']) {
                $default_avatar = request()->domain() . config('config.default_avatar');
            } else {
                $default_avatar = $wxuser['avatarUrl'];
            }

            $default_nickName = substr_replace($wxuser['phoneNumber'], '****', 3, 4);

            $data['mobile']      = $wxuser['phoneNumber'];
            $data['openid']      = $wxuser['openid'];
            $data['nickname']    = $default_nickName;
            $data['avatar']      = $default_avatar;
            $data['create_time'] = time();
            $data['status']      = 1;
            MemberService::add($data);
            $res = db("member")->where('openid', $wxuser['openid'])->find();
        } else {

            if (! $res['openid']) {
                db("member")->where('mobile', $wxuser['phoneNumber'])->update(['openid' => $wxuser['openid']]);
            }

        }

        //教师信息
        $teacher_info                  = db('teacher')->where('mid', $res['mid'])->find();
        $subject_id                    = explode(',', $teacher_info['subject_id']);
        $where1                        = [];
        $where1[]                      = ['subject_id', 'in', $subject_id];
        $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

        $data['token']       = $this->setToken($res['mid']);
        $res['teacher_info'] = $teacher_info;
        $data['user']        = $res;

        return json(['status' => 200, 'data' => $data]);

    }

    /**
     * @api {post} /login/mobileLogin 03、 手机号,验证码登陆
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  手机号,验证码登陆
     * @apiParam (输入参数：) {string}             code 小程序传入
     * @apiParam (输入参数：) {string}             mobile 手机号
     * @apiParam (输入参数：) {string}             verify  验证码
     */
    public function mobileLogin()
    {
        // * @apiParam (输入参数：) {string}
        $nickname = $this->request->param('nickname', '', '');
        $avatar   = $this->request->param('avatar', '', '');
        $code     = $this->request->param('code', '', '');
        $mobile   = $this->request->param('mobile', '', '');
        $verify   = $this->request->param('verify', '', '');
        if (! $mobile || ! $verify) {
            return json(['status' => 404, 'msg' => "参数不完整"]);
        }

        if ($code) {
            try {
                                                                        //获取 openid
                $wxuser = \utils\wechart\UserService::getOpenId($code); //获取小程序用户信息
            } catch (\Exception $e) {
                throw new ValidateException($e->getMessage());
            }
        }

        $yz_code = db("sms")->where("mobile", $mobile)->order("id desc")->value("code");
        if ($yz_code != $verify) {
            return json(['status' => 404, 'msg' => "验证码不正确"]);
        }

        $res = db("member")->where('mobile', $mobile)->find();

        if (! $res) {

            if (! $avatar) {
                $default_avatar = request()->domain() . config('config.default_avatar');
            } else {
                $default_avatar = $avatar;
            }
            $default_nickName = substr_replace($mobile, '****', 3, 4);

            $data['nickname']    = $default_nickName;
            $data['avatar']      = $default_avatar;
            $data['openid']      = $wxuser['openid'];
            $data['mobile']      = $mobile;
            $data['create_time'] = time();
            $data['status']      = 1;
            $mid                 = MemberService::add($data);
            $res                 = db("member")->where('mid', $mid)->find();
        } else {
            if (! $res['openid']) {
                db("member")->where('mobile', $mobile)->update(['openid' => $wxuser['openid']]);
            }
        }

        //教师信息
        $teacher_info                  = db('teacher')->where('mid', $res['mid'])->find();
        $subject_id                    = explode(',', $teacher_info['subject_id']);
        $where1                        = [];
        $where1[]                      = ['subject_id', 'in', $subject_id];
        $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

        $data['token']       = $this->setToken($res['mid']);
        $res['teacher_info'] = $teacher_info;
        $data['user']        = $res;

        return json(['status' => 200, 'data' => $data]);

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
        if (! $mobile) {
            return json(['status' => 404, 'msg' => "手机号不正确"]);
        }

        $t = db("sms")->where("mobile", $mobile)->order("id desc")->value("create_time");
        if (time() - $t < 120) {
            return json(['status' => 404, 'msg' => "操作过于频繁，请稍后重试"]);
        }
        //return json(['status' => 200, 'msg' => "发送成功"]);

        try {
            //发送验证码
            $code                  = rand(100000, 999999);
            $param['mobile']       = $mobile;
            $param['code']         = $code;
            $param['TemplateCode'] = 'SMS_461290092';
            $res                   = \utils\sms\AliSmsService::sendSms($param);

            //发送成功
            if ($res['Code'] == 'OK') {
                $data['type']        = 1;
                $data['reason']      = $res['reason'];
                $data['mobile']      = $mobile;
                $data['code']        = $code;
                $data['create_time'] = time();
                db("sms")->insert($data);
                return json(['status' => 200, 'msg' => "发送成功"]);
            }
        } catch (\Exception $e) {

            abort(config('my.error_log_code'), $e->getMessage());
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
        if (! $mobile || ! $verify) {
            return json(['status' => 404, 'msg' => "参数不完整"]);
        }

        $yz_code = db("sms")->where("mobile", $mobile)->order("id desc")->value("code");
        if ($yz_code != $verify) {
            return json(['status' => 404, 'msg' => "验证码不正确"]);
        }

        return json(['status' => 200, 'msg' => "验证成功"]);

    }

    /**
     * @api {post} /login/dyLogin 06、抖音手机号登陆
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  抖音手机号登陆
     * @apiParam (输入参数：) {string}             code 小程序传入
     * @apiParam (输入参数：) {string}             encryptedData 小程序传入
     * @apiParam (输入参数：) {string}             iv 小程序传入
     */
    public function dyLogin()
    {
        $code          = $this->request->param('code');
        $iv            = $this->request->param('iv');
        $encryptedData = $this->request->param('encryptedData');

        $appid  = config('my.dy_mini_program.app_id');
        $secret = config('my.dy_mini_program.secret');

        $url = "https://developer.toutiao.com/api/apps/jscode2session?appid=$appid&secret=$secret&code=$code";

        $resjson = httpRequest($url);
        if ($resjson['error'] == 0) {
            $key    = $resjson['session_key'];
            $openid = $resjson['openid'];
            //解密数据
            $dyuser = openssl_decrypt(base64_decode($encryptedData, true), 'AES-128-CBC', base64_decode($key), OPENSSL_RAW_DATA, base64_decode($iv));
            if (! $dyuser) {
                return json(['status' => 404, 'msg' => '手机号解密失败']);
            } else {

                $dyuser = json_decode($dyuser, true);
                $mobile = $dyuser['phoneNumber'];

                $res = db("member")->where('mobile', $mobile)->find();

                if (! $res) {
                    $default_nickName = substr_replace($mobile, '****', 3, 4);
                    $default_avatar   = request()->domain() . config('config.default_avatar');

                    $data['nickname']    = $default_nickName;
                    $data['avatar']      = $default_avatar;
                    $data['dy_openid']   = $openid;
                    $data['mobile']      = $mobile;
                    $data['create_time'] = time();
                    $data['status']      = 1;
                    $mid                 = MemberService::add($data);
                    $res                 = db("member")->where('mid', $mid)->find();
                } else {
                    if (! $res['dy_openid']) {
                        db("member")->where('mobile', $mobile)->update(['dy_openid' => $openid]);
                    }
                }

                //教师信息
                $teacher_info                  = db('teacher')->where('mid', $res['mid'])->find();
                $subject_id                    = explode(',', $teacher_info['subject_id']);
                $where1                        = [];
                $where1[]                      = ['subject_id', 'in', $subject_id];
                $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

                $data['token']       = $this->setToken($res['mid']);
                $res['teacher_info'] = $teacher_info;

                if ($res['update_mobile']) {
                    $res['mobile'] = $res['update_mobile'];
                }
                $data['user'] = $res;

                return json(['status' => 200, 'data' => $data]);

            }
        } else {
            return json(['status' => 404, 'msg' => '授权登陆失败']);
        }
    }

    /**
     * @api {post} /login/baiDuLogin 07、百度手机号登陆
     * @apiGroup 登陆
     * @apiVersion 1.0.0
     * @apiDescription  百度手机号登陆
     * @apiParam (输入参数：) {string}             code 小程序传入
     * @apiParam (输入参数：) {string}             encryptedData 小程序传入
     * @apiParam (输入参数：) {string}             iv 小程序传入
     */
    public function baiDuLogin()
    {
        try {
            $post   = \utils\Baidu::getUserInfo($this->request->param()); //获取用户信息
            $bduser = json_decode($post, true);
        } catch (\Exception $e) {
            throw new ValidateException($e->getMessage());
        }
        if (empty($bduser)) {
            throw new ValidateException('小程序获取失败');
        }

        $mobile = $bduser['mobile'];
        $openid = $bduser['openid'];
        $res    = db("member")->where('mobile', $mobile)->find();

        if (! $res) {
            $default_nickName = substr_replace($mobile, '****', 3, 4);
            $default_avatar   = request()->domain() . config('config.default_avatar');

            $data['nickname']    = $default_nickName;
            $data['avatar']      = $default_avatar;
            $data['bd_openid']   = $openid;
            $data['mobile']      = $mobile;
            $data['create_time'] = time();
            $data['status']      = 1;
            $mid                 = MemberService::add($data);
            $res                 = db("member")->where('mid', $mid)->find();
        } else {
            if (! $res['bd_openid']) {
                db("member")->where('mobile', $mobile)->update(['bd_openid' => $openid]);
            }
        }

        //教师信息
        $teacher_info                  = db('teacher')->where('mid', $res['mid'])->find();
        $subject_id                    = explode(',', $teacher_info['subject_id']);
        $where1                        = [];
        $where1[]                      = ['subject_id', 'in', $subject_id];
        $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

        $data['token']       = $this->setToken($res['mid']);
        $res['teacher_info'] = $teacher_info;

        if ($res['update_mobile']) {
            $res['mobile'] = $res['update_mobile'];
        }
        $data['user'] = $res;

        return json(['status' => 200, 'data' => $data]);
    }

}
