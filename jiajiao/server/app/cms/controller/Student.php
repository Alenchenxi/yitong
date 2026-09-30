<?php


namespace app\cms\controller;


class Student extends Base
{
    /**
     * 学生列表页面
     */
    public function index(){

        $subject_id = $this->request->param('subject_id', '', '');
        $gender = $this->request->param('gender', '', '');
        $area = $this->request->param('area', '', '');
        $teaching_way = $this->request->param('teaching_way', '', '');
        $teacher_identity = $this->request->param('teacher_identity', '', '');
        $class_status = $this->request->param('class_status', '', '')?$this->request->param('class_status', '', ''):1;

        if($subject_id){
            $where[] = ['a.subject_id','=',$subject_id];
        }
        if($gender){
            $where[] = ['a.gender','=',$gender];
        }
        if($this->city){
            $where[] = ['a.city','like',"$this->city"];
        }
        if($area){
            $where[] = ['a.area','find in set',$area];
        }

        if($teacher_identity){
            $where[] = ['a.teacher_identity','=',$teacher_identity];
        }

        if($class_status==2){
            $where[] = ['a.status','=',0];
        }

        $list = db("demand")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time,c.name as subject_name')
            ->join('member b','a.mid=b.mid','left')
            ->join('subject c','a.subject_id=c.subject_id','left')
            ->where($where)
            ->order('a.create_time desc')
            ->limit(10)
            ->select()->toArray();

        foreach ($list as $k => $v) {
            if($list[$k]['login_time']){
                $list[$k]['login_time'] = time_tran($list[$k]['login_time']);
            }else{
                $list[$k]['login_time'] = time_tran($list[$k]['create_time']);
            }

            if(!$list[$k]['avatar']){
                $list[$k]['avatar'] = request()->domain().'/uploads/admin/202210/63590f7d93628.png';
            }

            $list[$k]['create_time'] = date('Y-m-d H:i:s',$list[$k]['create_time']);
        }

        $this->view->assign('list', $list);

        return view('index/student');
    }


    /**
     * 学员发布页面
     */
    public function release(){

        if(request()->isPost()) {

        }else{
            $demand_id = $this->request->param('demand_id', '', '');


            if($demand_id){
                $info = db("demand")->alias('a')
                    ->field('a.*,b.nickname,b.avatar,b.login_time,c.name as subject_name,d.fee_set')
                    ->join('member b','a.mid=b.mid','left')
                    ->join('subject c','a.subject_id=c.subject_id','left')
                    ->join('teach_fee d','a.teach_fee_id=d.teach_fee_id','left')
                    ->where('a.demand_id',$demand_id)
                    ->find();


                $info['gender_str'] = getGenderStr($info['gender']);
                $info['teacher_gender_str'] = getGenderStr($info['teacher_gender']);
                $info['teacher_identity_str'] = getTeacherIdentityStr($info['teacher_identity']);

                $this->view->assign('info', $info);
            }

            $this->view->assign('nav', 3);
            return view('index/release');
        }


    }

    /**
     * @api {post} /student/studentsRelease 03、 学员发布
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  学员发布
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {string}      demand_id  需求id  传为修改  不传为添加
     * @apiParam (输入参数：) {string}      name 姓名
     * @apiParam (输入参数：) {number}      age 年龄
     * @apiParam (输入参数：) {string}      gender 性别  男|1|success,女|2|warning
     * @apiParam (输入参数：) {string}      subject_id 	任教科目
     * @apiParam (输入参数：) {string}      city 城市
     * @apiParam (输入参数：) {string}      area 任教区域名称
     * @apiParam (输入参数：) {string}      address 详细地址
     * @apiParam (输入参数：) {string}      gai_kuang 学员概况
     * @apiParam (输入参数：) {string}      expense 任教费用
     * @apiParam (输入参数：) {string}      teach_time 任教时间
     * @apiParam (输入参数：) {string}      teacher_gender 教员性别  男|1|success,女|2|warning
     * @apiParam (输入参数：) {string}      teacher_identity 教师身份  大学生教员|1|primary,普通教员|2|success,专业教员|3|danger
     * @apiParam (输入参数：) {string}      teacher_require 教员要求
     * @apiParam (输入参数：) {string}      linkman 联系人
     * @apiParam (输入参数：) {string}      mobile 手机号
     */
    public function studentsRelease()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $demand_id = $this->request->param('demand_id', '', '');
        $name = $this->request->param('name', '', '');
        $age = $this->request->param('age', '', '');
        $gender = $this->request->param('gender', '', '');
        $subject_id = $this->request->param('subject_id', '', '');
        $area = $this->request->param('area', '', '');
        $address = $this->request->param('address', '', '');
        $gai_kuang = $this->request->param('gai_kuang', '', '');
        $expense = $this->request->param('expense', '', '');
        $teach_time = $this->request->param('teach_time', '', '');
        $teacher_gender = $this->request->param('teacher_gender', '', '');
        $teacher_identity = $this->request->param('teacher_identity', '', '');
        $teacher_require = $this->request->param('teacher_require', '', '');
        $linkman = $this->request->param('linkman', '', '');
        $mobile = $this->request->param('mobile', '', '');

        if (!$subject_id || !$area || !$address || !$linkman || !$mobile) {
            return json(['status' => 404, 'msg' => "参数不完整"]);
        }

        $ins['sn'] = doOrderSn(00);
        $ins['mid'] = $this->mid;
        $ins['name'] = $name;
        $ins['age'] = $age;
        $ins['gender'] = $gender;
        $ins['subject_id'] = $subject_id;
        $ins['city'] = $this->city;
        $ins['area'] = $area;
        $ins['address'] = $address;
        $ins['gai_kuang'] = $gai_kuang;
        $ins['expense'] = $expense;
        $ins['teach_fee_id'] = db('teach_fee')->where("fee_set like '$expense'")->value('teach_fee_id');
        $ins['teach_time'] = $teach_time;
        $ins['teacher_gender'] = $teacher_gender;
        $ins['teacher_identity'] = $teacher_identity;
        $ins['teacher_require'] = $teacher_require;
        $ins['linkman'] = $linkman;
        $ins['mobile'] = $mobile;
        $ins['create_time'] = time();

        if($demand_id){
            //查询该科目 信息
            $demand_info = db('demand')->where('demand_id',$demand_id)->find();
            if($demand_info['subject_id'] != $subject_id){
                return json(['status' => 404, 'msg' => "不能修改科目"]);
            }

            db('demand')->where('demand_id',$demand_id)->update($ins);
            $msg = '修改';
        }else{
            //查询该科目 是否发布过需求 且正在发布中的
            $has = db('demand')->where('mid', $this->mid)->where('subject_id', $subject_id)->where('status', 0)->find();
            if($has){
                return json(['status' => 404, 'msg' => "您已经发布过该科目的需求,请勿重复发布"]);
            }

            db('demand')->insert($ins);
            $msg = '发布';
        }

        return json(['status' => 200, 'msg' => $msg.'成功']);
    }


    /**
     * @api {post} /student/getStudentList 、 获取学生列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取学生列表
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {string}      subject_id 	任教科目
     * @apiParam (输入参数：) {string}      gender 性别  男|1|success,女|2|warning
     * @apiParam (输入参数：) {string}      class_status 状态  全部|1|success,未完成|2|warning
     * @apiParam (输入参数：) {string}      city 任教城市
     * @apiParam (输入参数：) {string}      area 任教区域
     * @apiParam (输入参数：) {string}      teaching_way 任教方式  教员上门|1|primary,学生上门|2|success,网上辅导|3|info,住家辅导|4|warning
     */
    public function getStudentList()
    {
        $limit = $this->request->param('limit', '10', 'intval');
        $page = $this->request->param('page', 1, 'intval');
        $subject_id = $this->request->param('subject_id', '', '');
        $gender = $this->request->param('gender', '', '');
        $area = $this->request->param('area', '', '');
        $teaching_way = $this->request->param('teaching_way', '', '');
        $teacher_identity = $this->request->param('teacher_identity', '', '');
        $class_status = $this->request->param('class_status', '', '')?$this->request->param('class_status', '', ''):1;

        if($subject_id){
            $where[] = ['a.subject_id','=',$subject_id];
        }
        if($gender){
            $where[] = ['a.gender','=',$gender];
        }
        if($this->city){
            $where[] = ['a.city','like',"$this->city"];
        }
        if($area){
            $where[] = ['a.area','find in set',$area];
        }

        if($teacher_identity){
            $where[] = ['a.teacher_identity','=',$teacher_identity];
        }

        if($class_status==2){
            $where[] = ['a.status','=',0];
        }

        $list = db("demand")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time,c.name as subject_name')
            ->join('member b','a.mid=b.mid','left')
            ->join('subject c','a.subject_id=c.subject_id','left')
            ->where($where)
            ->order('a.create_time desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();

        foreach ($list as $k => $v) {
            if($list[$k]['login_time']){
                $list[$k]['login_time'] = time_tran($list[$k]['login_time']);
            }else{
                $list[$k]['login_time'] = time_tran($list[$k]['create_time']);
            }

            if(!$list[$k]['avatar']){
                $list[$k]['avatar'] = request()->domain().'/uploads/admin/202210/63590f7d93628.png';
            }

            $list[$k]['create_time'] = date('Y-m-d H:i:s',$list[$k]['create_time']);
        }

        return json(['status' => 200, 'data' => $list]);
    }


    /**
     * 学生详情页面
     */
    public function studentInfo(){

        //获取当前 学生需求id
        $type = $this->request->param('type', '', '');
        $demand_id = $this->request->param('demand_id', '', '');
        $mid = $this->mid;
        if(!$demand_id){
            return json(['status' => 404, 'msg' => "请先选择需求"]);
        }
        //查询学生信息
        $demand_info = db('demand')->where('demand_id', $demand_id)->find();
        if(!$demand_info){
            return json(['status' => 404, 'msg' => '对不起,没有找该学员信息']);
        }

        $info = db("demand")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time,c.name as subject_name')
            ->join('member b','a.mid=b.mid','left')
            ->join('subject c','a.subject_id=c.subject_id','left')
            ->where('a.demand_id',$demand_id)
            ->find();

        //计算平台中介费
        $subject_info = db('subject')->where('subject_id',$info['subject_id'])->find();
        $info['zj_price'] = $subject_info['price']*$subject_info['hours'];

        //is_contact  0不可以联系   1可以联系
        $info['is_contact'] = 0;
        $teacher_info = [];
        if($mid){
            $teacher_info = db('teacher')->where('mid',$mid)->find();
            $has = db('teacher_stu')->where('teacher_id', $teacher_info['teacher_id'])->where('demand_id', $demand_id)->where('status', 1)->find();
            if($has){
                $info['is_contact'] = 1;
            }

            $info['zj_price'] = $info['zj_price']*($teacher_info['discount']/100);
        }

        //后台设置每单最多可抢人数  order_grab_max
        $order_grab_max = config("config.order_grab_max");
        //查询 有几个老师查看过该学生信息
        $qry_num = db('teacher_stu')->alias('a')
            ->field('GROUP_CONCAT(b.name) as teacher_names,count(a.teacher_stu_id) as qry_num')
            ->join('teacher b','a.teacher_id=b.teacher_id','left')
            ->where('a.demand_id',$demand_id)->where('a.status',1)->find();

        //查询 查看名额是否已满 is_yiman 0未满  1已满
        $info['is_yiman'] = 0;
        $info['is_yiman_msg'] = '';
        if($qry_num['qry_num']>=$order_grab_max){
            $teacher_names_arr = explode(',',$qry_num['teacher_names']);
            $teacher_names = '';
            foreach ($teacher_names_arr as $k=>$v){
                $teacher_names = $teacher_names.' '.getShortName($v);
            }
            $info['is_yiman'] = 1;
            $info['is_yiman_msg'] = "此订单已有 ".$teacher_names." 与家长接洽沟通中";
        }

        $info['login_time'] = time_tran($info['login_time']);
        $info['create_time'] = date('Y-m-d',$info['create_time']);


        //判断按钮状态
        //1 联系学员,  2 支付20元  免费获取,  3 立即联系,  4 此订单已有老师联系,  5 已完成
        if($teacher_info && $teacher_info['status']==1 && $teacher_info['is_on_off']==1){
            //当老师信息 存在  且老师状态审核通过  且没有下线
            $button_status = 2;
            if($info['is_yiman']==1){
                //联系人 已满时
                $button_status = 4;
            }
            if($info['is_contact']==1){
                //能直接联系时
                $button_status = 3;
            }
            if($info['status']==1 || $info['status']==2){
                //当需求状态 为 完成时 或者 关闭时
                $button_status = 5;
            }
        }else{
            $button_status = 1;
        }

        //$button_status= 5;
        $info['button_status'] = $button_status;

        //查询助力信息
        $info['help_switch'] = config("config.help_switch");
        $info['help_num'] = config("config.help_num");

        $this->view->assign('type', $type);
        $this->view->assign('info', $info);
        return view('index/student_show');
    }


    /**
     * @api {post} /student/getMyCommentList 04、 获取我的评论列表
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  获取我的评论列表
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {number}      teacher_id 	老师id
     */
    public function getMyCommentList()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $limit = $this->request->param('limit', '10', 'intval');
        $page = $this->request->param('page', 1, 'intval');
        $teacher_id = $this->request->param('teacher_id','', 'intval');

        if($teacher_id){
            $where[] = ['a.teacher_id','=',$teacher_id];
        }else{
            $where[] = ['a.mid','=',$this->mid];
        }


        $list = db('comment')->alias('a')
            ->field('a.*,b.nickname,b.avatar,d.name as subject_name')
            ->join('member b','a.mid=b.mid','left')
            ->join('demand c','a.demand_id=c.demand_id','left')
            ->join('subject d','c.subject_id=d.subject_id','left')
            ->where($where)
            ->where('a.sup_comment_id',0)
            ->order('a.create_time desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['create_time'] = date('Y-m-d', $list[$k]['create_time']);

            $pics = json_decode(html_out($v['pics']),true);
            $pics_list = [];
            foreach ($pics as $key => $value) {
                $pics_list[]  = $value['url'];
            }
            $list[$k]['pics'] = $pics_list;

            $comment_lists = db('comment')->alias('a')
                ->field('a.*,b.nickname,b.avatar')
                ->join('member b','a.mid=b.mid','left')
                ->where('a.sup_comment_id',$v['comment_id'])
                ->select()->toArray();

            foreach ($comment_lists as $ck=>$cv){
                $cpics = json_decode(html_out($cv['pics']),true);
                $cpics_list = [];
                foreach ($cpics as $ckey => $cvalue) {
                    $cpics_list[]  = $cvalue['url'];
                }
                $comment_lists[$ck]['create_time'] = date('Y-m-d', $comment_lists[$ck]['create_time']);
                $comment_lists[$ck]['pics'] = $cpics_list;
            }

            $list[$k]['list'] = $comment_lists;
        }

        return json(['status' => 200, 'data' => $list]);
    }




    /**
     * @api {post} /student/addComment 07、 发表评论
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  发表评论
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      order_id 订单id
     * @apiParam (输入参数：) {number}      demand_id 需求id
     * @apiParam (输入参数：) {number}      teacher_id 老师id
     * @apiParam (输入参数：) {number}      attitude 教学态度   1星|1|primary,2星|2|success,3星|3|info,4星|4|warning,5星|5|danger
     * @apiParam (输入参数：) {number}      level 专业等级  1星|1|primary,2星|2|success,3星|3|info,4星|4|warning,5星|5|danger
     * @apiParam (输入参数：) {string}      content 评价内容
     * @apiParam (输入参数：) {string}      pics  图片  多个用 , 隔开
     * @apiParam (输入参数：) {string}      sup_comment_id  上级评论id  不传为0
     */
    public function addComment()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $order_id = $this->request->param('order_id', '', '');
        $demand_id = $this->request->param('demand_id', '', '');
        $teacher_id = $this->request->param('teacher_id', '', '');
        $attitude = $this->request->param('attitude', '', '');
        $level = $this->request->param('level', '', '');
        $content = $this->request->param('content', '', '');
        $pics = $this->request->param('pics', '', '');
        $sup_comment_id = $this->request->param('sup_comment_id', '', '')?$this->request->param('sup_comment_id', '', ''):0;


        if (!$teacher_id || !$demand_id || !$attitude || !$level || !$content) {
            return json(['status' => 404, 'msg' => "参数不完整"]);
        }

        $demand_info = db('demand')->where('demand_id',$demand_id)->find();
        if(!$demand_info){
            return json(['status' => 404, 'msg' => "没有找到该需求信息"]);
        }

        if(!$sup_comment_id){
            //没有上级 说明是 发表评论 查看是否评论
            $has_comment = db('comment')->where('teacher_id', $teacher_id)->where('demand_id', $demand_id)->find();
            if($has_comment){
                return json(['status' => 404, 'msg' => "您已发表过评论"]);
            }

        }else{
            //有上级 说明是 追加评论 查看是否追加
            $has_sup_comment = db('comment')->where('sup_comment_id', $sup_comment_id)->find();
            if($has_sup_comment){
                return json(['status' => 404, 'msg' => "您已追加过该评论"]);
            }

        }

        $ins['mid'] = $this->mid;
        $ins['order_id'] = $order_id;
        $ins['demand_id'] = $demand_id;
        $ins['teacher_id'] = $teacher_id;
        $ins['subject_id'] = $demand_info['subject_id'];
        $ins['attitude'] = $attitude;
        $ins['level'] = $level;
        $ins['content'] = $content;
        $ins['sup_comment_id'] = $sup_comment_id;
        $ins['create_time'] = time();

        if ($pics) {
            $pics = explode(',', $pics);

            foreach ($pics as $key => $value) {
                $arr[$key]['url'] = $value;
            }
            $pics = json_encode($arr, JSON_UNESCAPED_UNICODE);

            $ins['pics'] = $pics;
        }

        db('comment')->insert($ins);

        //计算平均分
        //教学态度
        $total_attitude = db('comment')->where('teacher_id', $teacher_id)->sum('attitude');
        //专业度
        $total_level = db('comment')->where('teacher_id', $teacher_id)->sum('level');
        $total_comment_num = db('comment')->where('teacher_id', $teacher_id)->count();

        $avg_score = cusDecimal(($total_attitude+$total_level)/2/$total_comment_num);
        //修改 老师平均分支
        db('teacher')->where('teacher_id', $teacher_id)->update(['avg_score'=>$avg_score]);

        return json(['status' => 200, 'msg' => '发布成功']);
    }



    /**
     * @api {post} /student/addAppointment 11、 添加预约
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  添加预约
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      teacher_id 教师id
     * @apiParam (输入参数：) {number}      demand_id  需求id
     */
    public function addAppointment()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $teacher_id = $this->request->param('teacher_id', '', 'intval');
        $demand_id = $this->request->param('demand_id', '', 'intval');

        if(!$teacher_id || !$demand_id){
            return json(['status' => 404, 'msg' => "参数不完整"]);
        }

        $teacher_info = db('teacher')->where('teacher_id', $teacher_id)->find();
        if(!$teacher_info){
            return json(['status' => 404, 'msg' => "对不起没有找到该老师信息"]);
        }

        /*print_r('teacher_id'.$teacher_id);
        print_r('demand_id'.$demand_id);*/

        $has = db("appointment")->where('mid', $this->mid)->where('teacher_id', $teacher_id)->where('demand_id', $demand_id)->find();

        if($has){
            return json(['status' => 404, 'msg' => '您的该学员信息,已预约该老师,请勿重复预约']);
        }

        try{
            db()->startTrans();

            $ins['mid'] = $this->mid;
            $ins['teacher_id'] = $teacher_id;
            $ins['demand_id'] = $demand_id;
            $ins['create_time'] = time();

            //添加预约
            db("appointment")->insert($ins);

            //添加老师预约次数
            db('teacher')->where('teacher_id', $teacher_id)->inc('yuyue_num')->update();

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }

        //发送短信
        $param['mobile'] = $teacher_info['mobile'];
        $param['TemplateCode'] = 'SMS_257710870';
        $res       = \utils\sms\AliSmsService::sendSms($param,2);

        return json(['status' => 200, 'msg' => '预约成功']);
    }


    /**
     * @api {post} /student/getStuAppointmentList 14、 获取学生预约订单
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  获取学生预约订单
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     */
    public function getStuAppointmentList()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $limit = $this->request->param('limit', '10', 'intval');
        $page = $this->request->param('page', 1, 'intval');

        $list = db("appointment")->alias('a')
            ->field('a.appointment_id,b.*,c.nickname,c.avatar,c.login_time,d.name as subject_name')
            ->join('demand b','a.demand_id=b.demand_id','left')
            ->join('member c','b.mid=c.mid','left')
            ->join('subject d','b.subject_id=d.subject_id','left')
            ->where('a.mid',$this->mid)
            ->order('a.create_time desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['login_time'] = time_tran($list[$k]['login_time']);
        }

        return json(['status' => 200, 'data' => $list]);
    }



    /**
     * @api {post} /student/getStuDemandList 15、 获取学生订单
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  获取学生订单
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {number}      status 状态   完成订单|1|primary,待上订单|0|success
     */
    public function getStuDemandList()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $limit = $this->request->param('limit', '10', 'intval');
        $page = $this->request->param('page', 1, 'intval');
        $status = $this->request->param('status', '', 'intval');

        $where[] = ['a.mid','=',$this->mid];
        $where[] = ['a.status','=',$status];

        $list = db("demand")->alias('a')
            ->field('a.*,c.nickname,c.avatar,c.login_time,d.name as subject_name')
            ->join('member c','a.mid=c.mid','left')
            ->join('subject d','a.subject_id=d.subject_id','left')
            ->where($where)
            ->order('a.create_time desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();;

        foreach ($list as $k => $v) {
            $list[$k]['login_time'] = time_tran($list[$k]['login_time']);
            //查看是否评论
            $list[$k]['is_pl'] = db('comment')->where('teacher_id', $v['teacher_id'])->where('demand_id', $v['demand_id'])->where('sup_comment_id',0)->find();
            //查看是否追加
            $list[$k]['is_zp'] = db('comment')->where('sup_comment_id', $list[$k]['is_pl']['comment_id'])->find();

        }

        return json(['status' => 200, 'data' => $list]);
    }



    /**
     * @api {post} /student/getDelDemand 15、 关闭学生需求(订单)
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  删除学生需求(订单)
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      demand_id   需求id
     */
    public function getDelDemand()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }
        $demand_id = $this->request->param('demand_id', '', 'intval');

        $where[] = ['mid','=',$this->mid];
        $where[] = ['demand_id','=',$demand_id];
        $demand_info = db("demand")->where($where)->find();

        if(!$demand_info){
            return json(['status' => 404, 'msg' => "没有找到您的该需求信息"]);
        }

        if($demand_info['status']!=0){
            return json(['status' => 404, 'msg' => "该订单不是待上订单,不能关闭"]);
        }

        try {
            db()->startTrans();

            //关闭 学生订单状态
            db('demand')->where('demand_id',$demand_id)->update(['status'=>2]);
            //将购买过的订单 都 自动申请退款
            db('order')->where('demand_id',$demand_id)->where('status',1)->update(['status'=>2,'refund_cause'=>'订单关闭','pay_time'=>time()]);
            //将未支付过的待付订单 都 删除
            db('order')->where('demand_id',$demand_id)->where('status',0)->delete();
            //删除 其他 该需求的 预约订单
            db('appointment')->where('demand_id',$demand_id)->delete();

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }

        return json(['status' => 200, 'msg' => '关闭成功']);
    }



    /**
     *查看申请
     */
    public function getDemandTeacherList()
    {
        $demand_id = $this->request->param('demand_id', '', 'intval');

        if(!$demand_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $teacher_ids = db('order')->where('demand_id',$demand_id)->where('status in (1,4)')->column('teacher_id');

        $where[] = ['a.teacher_id','in',$teacher_ids];
        $where[] = ['a.is_hide','=',0];
        $where[] = ['a.status','=',1];
        $where[] = ['a.is_on_off','=',1];

        $list = db("teacher")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time')
            ->join('member b','a.mid=b.mid','left')
            ->where($where)
            ->order('a.stick_time desc,a.refresh_time desc,a.teacher_id desc')
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['name'] = getShortName($list[$k]['name']);
            $list[$k]['login_time'] = time_tran($list[$k]['login_time']);

            $subject_id = explode(',',$v['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $list[$k]['subject_names'] = db('subject')->where($where1)->limit(3)->select()->toArray();
        }

        return json(['status' => 200, 'data' => $list]);

    }


}