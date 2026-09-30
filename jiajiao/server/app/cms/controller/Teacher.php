<?php


namespace app\cms\controller;


use think\exception\ValidateException;

class Teacher extends Base
{

    /**
     * 老师列表页面
     */
    public function index(){

        $teacher_num = $this->request->param('teacher_num', '', '');
        $gender = $this->request->param('gender', '', '');
        $teaching_way = $this->request->param('teaching_way', '', '');
        $zh_pj = $this->request->param('zh_pj', '', '');
        $grade_id = $this->request->param('grade_id', '', '');
        $subject_id = $this->request->param('subject_id', '', '');
        $college_name = $this->request->param('college_name', '', '');
        $teacher_identity = $this->request->param('teacher_identity', '', '');
        $city = $this->city;
        $area = $this->request->param('area', '', '');

        if($teacher_num){
            $where[] = ['a.teacher_id','=',$teacher_num];
        }

        if($gender){
            $where[] = ['a.gender','=',$gender];
        }

        if($teaching_way){
            $where[] = ['a.teaching_way','=',$teaching_way];
        }

        if($zh_pj==1){
            $where[] = ['a.avg_score','>=',3];
        }

        if($zh_pj==2){
            $where[] = ['a.avg_score','<',3];
        }

        if($grade_id){
            $where[] = ['a.grade_id','find in set',$grade_id];
        }

        if($subject_id){
            $where[] = ['a.subject_id','find in set',$subject_id];
        }
        if($college_name){
            $where[] = ['a.school','like',"$college_name"];
        }
        if($teacher_identity){
            $where[] = ['a.teacher_identity','=',$teacher_identity];
        }
        if($city){
            $where[] = ['a.city','like',"$city"];
        }

        if($area){
            $where[] = ['a.area','find in set',$area];
        }

        //获取 为隐藏简历的
        $where[] = ['a.is_hide','=',0];
        $where[] = ['a.status','=',1];
        $where[] = ['a.is_on_off','=',1];

        $list = db("teacher")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time')
            ->join('member b','a.mid=b.mid','left')
            ->where($where)
            ->order('a.stick_time desc,a.refresh_time desc,a.teacher_id desc')
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

            if(!$list[$k]['head_img']){
                $list[$k]['head_img'] = $list[$k]['avatar'];
            }

            $list[$k]['name'] = getShortName($list[$k]['name']);
            $list[$k]['gender_str'] = getGenderStr($list[$k]['gender']);
            $list[$k]['teacher_identity_str'] = getTeacherIdentityStr($list[$k]['teacher_identity']);

            $list[$k]['area'] = array_slice(explode(',',$v['area']),0,3);
            //$list[$k]['area'] = explode(',',$v['area']);

            $subject_id = explode(',',$v['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $list[$k]['subject_names'] = db('subject')->where($where1)->limit(3)->select()->toArray();
        }
        $this->view->assign('list',$list);

        return view('index/teacher');
    }


    /**
     * 老师注册页面
     */
    public function register(){

        $this->view->assign('nav', 2);
        return view('index/register');
    }


    /**
     * @api {post} /teacher/teacherReg 09、 教师注册
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  教师注册
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {string}      head_img 头像
     * @apiParam (输入参数：) {string}      name 姓名
     * @apiParam (输入参数：) {number}      age 年龄
     * @apiParam (输入参数：) {string}      gender 性别  男|1|success,女|2|warning
     * @apiParam (输入参数：) {string}      mobile 手机号
     * @apiParam (输入参数：) {string}      id_number 	身份证号码
     * @apiParam (输入参数：) {string}      school	 	学校
     * @apiParam (输入参数：) {string}      specialty	 	专业
     * @apiParam (输入参数：) {string}      teacher_identity 教师身份  大学生教员|1|primary,普通教员|2|success,专业教员|3|danger
     * @apiParam (输入参数：) {string}      teaching_age 	教龄
     * @apiParam (输入参数：) {string}      subject_id 	任教科目  多个用 , 隔开
     * @apiParam (输入参数：) {string}      teaching_way  任教方式  教员上门|1|primary,学生上门|2|success,网上辅导|3|info,住家辅导|4|warning
     * @apiParam (输入参数：) {string}      city 任教城市
     * @apiParam (输入参数：) {string}      area 任教区域名称   多个用 , 隔开
     * @apiParam (输入参数：) {string}      salary 课酬要求
     * @apiParam (输入参数：) {string}      id_card_zheng 身份证正面
     * @apiParam (输入参数：) {string}      id_card_fan 身份证反面
     * @apiParam (输入参数：) {string}      student_card_img 学生证
     * @apiParam (输入参数：) {string}      diploma_img 学历证
     * @apiParam (输入参数：) {string}      itic_img 教师证
     * @apiParam (输入参数：) {string}      self_desc 自我描述
     * @apiParam (输入参数：) {string}      experience 任教经验
     * @apiParam (输入参数：) {string}      certificate 所获证书

     */
    public function teacherReg()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        //获取所有参数
        $param = $this->request->param();

        if($param['subject_id']){
            $subject_id = $param['subject_id'];
            //查询 学科所属年级
            $subject_ids  = explode(',',$subject_id);
            $wheresub[] = ['subject_id','in',$subject_ids];
            $grade_ids = db('subject')->where($wheresub)->group('grade_id')->column('grade_id');
            $param['grade_id'] = implode($grade_ids,',');
        }

        //查询该账户有没有 教员信息 有则修改没有则更新
        $has_teacher_info = db('teacher')->where('mid', $this->mid)->find();

        if($has_teacher_info){

            //如果状态等于 已通过  则不能 修改身份证
            if($has_teacher_info['status']==1){
                if($param['id_number'] && ($param['id_number'] != $has_teacher_info['id_number']) ){
                    return json(['status' => 404, 'msg' => "审核通过后,身份证号不能修改"]);
                }

                if($param['id_card_zheng'] && ($param['id_card_zheng'] != $has_teacher_info['id_card_zheng']) ){
                    return json(['status' => 404, 'msg' => "审核通过后,身份证不能修改"]);
                }

                if($param['id_card_fan'] && ($param['id_card_fan'] != $has_teacher_info['id_card_fan']) ){
                    return json(['status' => 404, 'msg' => "审核通过后,身份证不能修改"]);
                }
            }

            //去掉老师是否上下线的值
            unset($param['is_on_off	']);

            db('teacher')->where('mid', $this->mid)->update($param);
        }else{
            if (!$param['name'] || !$param['subject_id'] || !$param['mobile'] || !$param['id_number'] || !$param['specialty'] || !$param['teacher_identity'] || !$param['teaching_way'] || !$param['area'] || !$param['id_card_zheng'] || !$param['id_card_fan']) {
                return json(['status' => 404, 'msg' => "参数不完整"]);
            }

            //刷新时间(创建相当于最新刷新)
            $param['refresh_time'] = time();
            $param['mid'] = $this->mid;
            db('teacher')->insert($param);

            //修改用户 身份
            db('member')->where('mid', $this->mid)->update(['groupid'=>2]);
        }

        return json(['status' => 200, 'msg' => '提交审核中']);
    }


    /**
     * @api {post} /teacher/getTeacherList 、 获取老师列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取老师列表
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {string}      teacher_num 	教员编号
     * @apiParam (输入参数：) {number}      gender 	性别 男|1|success,女|2|warning
     * @apiParam (输入参数：) {number}      teaching_way 	任教方式  教员上门|1|primary,学生上门|2|success,网上辅导|3|info,住家辅导|4|warning,不限|5|danger
     * @apiParam (输入参数：) {number}      zh_pj 	综合评价 高|1|success,低|2|warning
     * @apiParam (输入参数：) {string}      grade_id 	年级类别id
     * @apiParam (输入参数：) {string}      subject_id 	任教科目
     * @apiParam (输入参数：) {string}      college_name  大学名称
     * @apiParam (输入参数：) {string}      teacher_identity 教师身份  大学生教员|1|primary,普通教员|2|success,专业教员|3|danger
     * @apiParam (输入参数：) {string}      city 任教城市
     * @apiParam (输入参数：) {string}      area 任教区域
     */
    public function getTeacherList()
    {
        $limit = $this->request->param('limit', '10', 'intval');
        $page = $this->request->param('page', 1, 'intval');
        $teacher_num = $this->request->param('teacher_num', '', '');
        $gender = $this->request->param('gender', '', '');
        $teaching_way = $this->request->param('teaching_way', '', '');
        $zh_pj = $this->request->param('zh_pj', '', '');
        $grade_id = $this->request->param('grade_id', '', '');
        $subject_id = $this->request->param('subject_id', '', '');
        $college_name = $this->request->param('college_name', '', '');
        $teacher_identity = $this->request->param('teacher_identity', '', '');
        $city = $this->city;
        $area = $this->request->param('area', '', '');

        if($teacher_num){
            $where[] = ['a.teacher_id','=',$teacher_num];
        }

        if($gender){
            $where[] = ['a.gender','=',$gender];
        }

        if($teaching_way){
            $where[] = ['a.teaching_way','=',$teaching_way];
        }

        if($zh_pj==1){
            $where[] = ['a.avg_score','>=',3];
        }

        if($zh_pj==2){
            $where[] = ['a.avg_score','<',3];
        }

        if($grade_id){
            $where[] = ['a.grade_id','find in set',$grade_id];
        }

        if($subject_id){
            $where[] = ['a.subject_id','find in set',$subject_id];
        }
        if($college_name){
            $where[] = ['a.school','like',"$college_name"];
        }
        if($teacher_identity){
            $where[] = ['a.teacher_identity','=',$teacher_identity];
        }
        if($city){
            $where[] = ['a.city','like',"$city"];
        }

        if($area){
            $where[] = ['a.area','find in set',$area];
        }

        //获取 为隐藏简历的
        $where[] = ['a.is_hide','=',0];
        $where[] = ['a.status','=',1];
        $where[] = ['a.is_on_off','=',1];

        $list = db("teacher")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time')
            ->join('member b','a.mid=b.mid','left')
            ->where($where)
            ->order('a.stick_time desc,a.refresh_time desc,a.teacher_id desc')
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

            if(!$list[$k]['head_img']){
                $list[$k]['head_img'] = $list[$k]['avatar'];
            }

            $list[$k]['name'] = getShortName($list[$k]['name']);
            $list[$k]['gender_str'] = getGenderStr($list[$k]['gender']);
            $list[$k]['teacher_identity_str'] = getTeacherIdentityStr($list[$k]['teacher_identity']);

            $list[$k]['area'] = array_slice(explode(',',$v['area']),0,3);
            //$list[$k]['area'] = explode(',',$v['area']);

            $subject_id = explode(',',$v['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $list[$k]['subject_names'] = db('subject')->where($where1)->limit(3)->select()->toArray();
        }

        return json(['status' => 200, 'data' => $list]);
    }


    /**
     * 老师详情页面
     */
    public function teacherInfo(){
        $teacher_id = $this->request->param('teacher_id', '', 'intval');
        $mid = $this->mid;

        if(!$teacher_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $where[] = ['a.teacher_id','=',$teacher_id];

        $info = db("teacher")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time')
            ->join('member b','a.mid=b.mid','left')
            ->where($where)
            ->find();

        $info['login_time'] = time_tran($info['login_time']);
        $info['name'] = getShortName($info['name']);

        $subject_id = explode(',',$info['subject_id']);
        $where1 = [];
        $where1[] = ['subject_id','in',$subject_id];
        $info['subject_names'] = db('subject')->where($where1)->column('name');

        $info['is_collect'] = 0;
        if($mid){
            //判断当前用户是否 收藏该老师  is_collect 0未收藏  1已收藏
            $has = db("collect")->where('mid', $mid)->where('teacher_id', $teacher_id)->find();
            if($has){
                $info['is_collect'] = 1;
            }
        }

        //查询 老师所在城市 是否可以直接联系
        $is_direct_contact = db('direct_contact')->where("city like '".$info['city']."%'")->find();
        $info['is_direct_contact'] = 0;
        if($is_direct_contact['is_open']==1){
            $info['is_direct_contact'] = 1;
        }


        $info['subject_names_str'] = implode(',',$info['subject_names']);
        $info['gender_str'] = getGenderStr($info['gender']);
        $info['teacher_identity_str'] = getTeacherIdentityStr($info['teacher_identity']);
        $info['teaching_way_str'] = getTeachingWayStr($info['teaching_way']);

        //评价数
        $info['comment_num'] =db('demand')->alias('a')
            ->join('comment b','a.demand_id=b.demand_id','left')->where('a.teacher_id', $teacher_id)->where('b.sup_comment_id', 0)->count();

        //查询评价内容
        $list = db('demand')->alias('a')
            ->field('b.*,c.nickname,c.avatar,d.name as subject_name')
            ->join('comment b','a.demand_id=b.demand_id','left')
            ->join('member c','b.mid=c.mid','left')
            ->join('subject d','a.subject_id=d.subject_id','left')
            ->where('a.teacher_id',$teacher_id)
            ->where('b.sup_comment_id',0)
            ->order('b.stick_time desc,b.create_time desc')
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['create_time'] = date('Y-m-d', $list[$k]['create_time']);

            if (!$list[$k]['content']) {
                $list[$k]['content'] = '该学员暂未评论';
            }

            $pics = json_decode(html_out($v['pics']), true);
            $pics_list = [];
            foreach ($pics as $key => $value) {
                $pics_list[] = $value['url'];
            }
            $list[$k]['pics'] = $pics_list;

            $comment_lists = db('comment')->alias('a')
                ->field('a.*,b.nickname,b.avatar,d.name as subject_name')
                ->join('member b', 'a.mid=b.mid', 'left')
                ->join('demand c', 'a.demand_id=c.demand_id', 'left')
                ->join('subject d', 'c.subject_id=d.subject_id', 'left')
                ->where('a.sup_comment_id', $v['comment_id'])
                ->order('a.stick_time desc,a.create_time desc')
                ->select()->toArray();

            foreach ($comment_lists as $ck => $cv) {
                $cpics = json_decode(html_out($cv['pics']), true);
                $cpics_list = [];
                foreach ($cpics as $ckey => $cvalue) {
                    $cpics_list[] = $cvalue['url'];
                }
                $comment_lists[$ck]['pics'] = $cpics_list;
                $comment_lists[$ck]['create_time'] = date('Y-m-d', $cv['create_time']);
            }

            $list[$k]['list'] = $comment_lists;
        }

        $this->view->assign('info', $info);
        $this->view->assign('comment_list', $list);
        return view('index/teacher_show');
    }



    /**
     * @api {post} /teacher/refreshCv 12、 刷新简历
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  刷新简历
     * @apiHeader {String} Authorization 用户授权token
     */
    public function refreshCv()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $teacher_info = db("teacher")->where('mid', $this->mid)->find();

        if(!$teacher_info){
            return json(['status' => 404, 'msg' => '没有找到您的老师信息']);
        }

        $day_ref_info = db('day_refresh')->where('teacher_id', $teacher_info['teacher_id'])->where('date', date('Y-m-d'))->find();
        if($day_ref_info){
            return json(['status' => 404, 'msg' => '您今日已刷新,不能再次刷新']);
        }

        db("teacher")->where('teacher_id', $teacher_info['teacher_id'])->update(['refresh_time'=>time()]);

        $ins['date'] = date('Y-m-d');
        $ins['mid'] = $this->mid;
        $ins['teacher_id'] = $teacher_info['teacher_id'];
        //添加 今日刷新记录
        db('day_refresh')->insert($ins);

        return json(['status' => 200, 'msg' => '刷新成功']);
    }



    /**
     * @api {post} /teacher/hideOrOpenResume 、 隐藏或打开简历
     * @apiGroup 会员
     * @apiVersion 1.0.0
     * @apiDescription  隐藏简历
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (输入参数：) {number}      teacher_id   教师id
     */
    public function hideOrOpenResume()
    {
        if (!$this->mid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }

        $where[] = ['mid','=',$this->mid];
        $teacher_info = db("teacher")->where($where)->find();

        if($teacher_info['is_hide'] == 1){
            $is_hide = 0;
            $msg = '简历取消隐藏';
        }else{
            $is_hide = 1;
            $msg = '简历隐藏';
        }
        db("teacher")->where($where)->update(['is_hide'=>$is_hide]);

        return json(['status' => 200, 'msg' => $msg.'成功']);
    }



    /**
     *我的简历
     */
    public function myResume()
    {
        if(request()->isPost()) {
            //教师信息
            $teacher_info = db('teacher')->where('mid',$this->mid)->find();
            $subject_id = explode(',',$teacher_info['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

            return json(['status' => 200, 'data' => $teacher_info]);
        }else{
            return view('index/my_resume');
        }

    }

    /**
     * 获取套餐
     */
    public function getSetMeal()
    {
        $list = db('set_meal')->select()->toArray();
        return json(['status' => 200, 'data' => $list]);
    }

    /**
     *教师中心 我的预约订单
     */
    public function yyOrder()
    {
        if(request()->isPost()) {
            if (!$this->mid) {
                return json(['status' => 404, 'msg' => "登陆超时"]);
            }

            $limit = $this->request->param('limit', '10', 'intval');
            $page = $this->request->param('page', 1, 'intval');

            //教师信息
            $teacher_info = db('teacher')->where('mid', $this->mid)->find();

            $list = db("appointment")->alias('a')
                ->field('a.appointment_id,b.*,c.nickname,c.avatar,c.login_time,d.name as subject_name')
                ->join('demand b','a.demand_id=b.demand_id','left')
                ->join('member c','b.mid=c.mid','left')
                ->join('subject d','b.subject_id=d.subject_id','left')
                ->where('a.teacher_id',$teacher_info['teacher_id'])
                ->order('a.create_time desc')
                ->limit(($page - 1) * $limit, $limit)
                ->select()->toArray();;

            foreach ($list as $k => $v) {
                $list[$k]['login_time'] = time_tran($list[$k]['login_time']);
            }

            return json(['status' => 200, 'data' => $list]);
        }else{
            return view('index/yy_order');
        }

    }


    /**
     *教师中心 我的订单
     */
    public function myOrder()
    {
        if(request()->isPost()) {
            if (!$this->mid) {
                return json(['status' => 404, 'msg' => "登陆超时"]);
            }

            $limit = $this->request->param('limit', '10', 'intval');
            $page = $this->request->param('page', 1, 'intval');
            $order_state = $this->request->param('order_state', '', '')?$this->request->param('order_state', '', ''):0;

            $where[] = ['a.mid','=',$this->mid];

            //已购|1|success,待付|2|warning,已完成|3|success  不传默认0
            if($order_state==1){
                $where[] = ['a.status','in',[1,2]];
            }elseif($order_state==2){
                $where[] = ['a.status','=',0];
            }elseif ($order_state==3){
                $where[] = ['a.status','in',[3,4]];
            }else{
                $where[] = ['a.status','=',0];
            }


            $list = db("order")->alias('a')
                ->field('a.order_id,a.status as order_status,b.*,c.nickname,c.avatar,c.login_time,d.name as subject_name,a.type')
                ->join('demand b','a.demand_id=b.demand_id','left')
                ->join('member c','b.mid=c.mid','left')
                ->join('subject d','b.subject_id=d.subject_id','left')
                ->where($where)
                ->order('a.create_time desc')
                ->limit(($page - 1) * $limit, $limit)
                ->select()->toArray();

            foreach ($list as $k => $v) {
                $list[$k]['login_time'] = time_tran($list[$k]['login_time']);
            }

            return json(['status' => 200, 'data' => $list]);
        }else{
            $order_state = $this->request->param('order_state', '', '')?$this->request->param('order_state', '', ''):0;

            $this->view->assign('order_state',$order_state);
            return view('index/my_order');
        }

    }



    /**
     *教师中心 我的评价
     */
    public function teacherCommentList()
    {
        if(request()->isPost()) {
            $limit = $this->request->param('limit', '', 'intval')?$this->request->param('limit', '', 'intval'):10;
            $page = $this->request->param('page', '', 'intval')?$this->request->param('page', '', 'intval'):1;


            $teacher_id = db('teacher')->where('mid',$this->mid)->value('teacher_id');

            $list = db('demand')->alias('a')
                ->field('b.*,c.nickname,c.avatar,d.name as subject_name')
                ->join('comment b','a.demand_id=b.demand_id','left')
                ->join('member c','b.mid=c.mid','left')
                ->join('subject d','a.subject_id=d.subject_id','left')
                ->where('a.teacher_id',$teacher_id)
                ->where('b.sup_comment_id',0)
                ->order('b.stick_time desc,b.create_time desc')
                ->limit(($page - 1) * $limit, $limit)
                ->select()->toArray();

            foreach ($list as $k => $v) {
                $list[$k]['create_time'] = date('Y-m-d', $list[$k]['create_time']);

                if(!$list[$k]['content']){
                    $list[$k]['content'] = '该学员暂未评论';
                }

                $pics = json_decode(html_out($v['pics']),true);
                $pics_list = [];
                foreach ($pics as $key => $value) {
                    $pics_list[]  = $value['url'];
                }
                $list[$k]['pics'] = $pics_list;

                $comment_lists = db('comment')->alias('a')
                    ->field('a.*,b.nickname,b.avatar,d.name as subject_name')
                    ->join('member b','a.mid=b.mid','left')
                    ->join('demand c','a.demand_id=c.demand_id','left')
                    ->join('subject d','c.subject_id=d.subject_id','left')
                    ->where('a.sup_comment_id',$v['comment_id'])
                    ->order('a.stick_time desc,a.create_time desc')
                    ->select()->toArray();

                foreach ($comment_lists as $ck=>$cv){
                    $cpics = json_decode(html_out($cv['pics']),true);
                    $cpics_list = [];
                    foreach ($cpics as $ckey => $cvalue) {
                        $cpics_list[]  = $cvalue['url'];
                    }
                    $comment_lists[$ck]['pics'] = $cpics_list;
                    $comment_lists[$ck]['create_time'] = date('Y-m-d',$cv['create_time']);
                }

                $list[$k]['list'] = $comment_lists;
            }

            $count = count($list);
            $bc_list = [];
            if($page==1 && $count<10){
                $all_liat = db('demand')->alias('a')
                    ->field('b.*,c.nickname,c.avatar,a.create_time,d.name as subject_name')
                    ->join('comment b','a.demand_id=b.demand_id','left')
                    ->join('member c','a.mid=c.mid','left')
                    ->join('subject d','a.subject_id=d.subject_id','left')
                    ->where('a.teacher_id',$teacher_id)
                    ->select()->toArray();

                foreach ($all_liat as $k=>$v){
                    if(!$v['comment_id']){
                        $v['create_time'] = date('Y-m-d',$v['create_time']);
                        $v['content'] = '该用户暂未评论';
                        $bc_list[] = $v;
                    }
                }
            }

            $list = array_merge($list,$bc_list);

            return json(['status' => 200, 'data' => $list]);
        }else{
            return view('index/my_comment');
        }

    }


    /**
     * @api {post} /teacher/stickComment 、 置顶评论
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  置顶评论
     * @apiParam (输入参数：) {number}      comment_id  评论id
     * @apiParam (输入参数：) {number}      teacher_id  老师id
     */
    public function stickComment()
    {
        $comment_id = $this->request->param('comment_id', '', 'intval');

        if(!$comment_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $teacher_id = db('teacher')->where('mid',$this->mid)->value('teacher_id');
        $comment_info = db('comment')->where('comment_id', $comment_id)->where('teacher_id', $teacher_id)->find();

        if(!$comment_info){
            return json(['status' => 404, 'msg' => '没有找到有关于您的这条评论']);
        }

        db('comment')->where('comment_id',$comment_id)->update(['stick_time'=>time()]);

        return json(['status' => 200, 'msg' => '置顶成功']);
    }

    /**
     *教师中心 接单说明
     */
    public function getTakeOrderSm()
    {
        if(request()->isPost()) {
            return json(['status' => 200, 'data' => format_html(config("config.take_order_sm"))]);
        }else{

            //查询后台 设置的接单说明
            $take_order_sm = format_html(config("config.take_order_sm"));
            $this->view->assign('info', $take_order_sm);

            return view('index/jd_explain');
        }
    }



    /**
     *修改简历
     */
    public function updateResume()
    {
        if(request()->isPost()) {

        }else{
            $type = $this->request->param('type', '', 'intval')?$this->request->param('type', '', 'intval'):1;


            $teacher_id = $this->request->param('teacher_id', '', 'intval');
            $mid = $this->mid;

            $where[] = ['a.mid','=',$mid];

            $info = db("teacher")->alias('a')
                ->field('a.*,b.nickname,b.avatar,b.login_time')
                ->join('member b','a.mid=b.mid','left')
                ->where($where)
                ->find();

            $info['login_time'] = time_tran($info['login_time']);
            $info['name'] = getShortName($info['name']);

            $subject_id = explode(',',$info['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $info['subject_names'] = db('subject')->where($where1)->column('name');

            $info['is_collect'] = 0;
            if($mid){
                //判断当前用户是否 收藏该老师  is_collect 0未收藏  1已收藏
                $has = db("collect")->where('mid', $mid)->where('teacher_id', $teacher_id)->find();
                if($has){
                    $info['is_collect'] = 1;
                }
            }

            //查询 老师所在城市 是否可以直接联系
            $is_direct_contact = db('direct_contact')->where("city like '".$info['city']."%'")->find();
            $info['is_direct_contact'] = 0;
            if($is_direct_contact['is_open']==1){
                $info['is_direct_contact'] = 1;
            }

            $info['subject_names_str'] = implode(',',$info['subject_names']);
            $info['gender_str'] = getGenderStr($info['gender']);
            $info['teacher_identity_str'] = getTeacherIdentityStr($info['teacher_identity']);
            $info['teaching_way_str'] = getTeachingWayStr($info['teaching_way']);

            //评价数
            $info['comment_num'] =db('demand')->alias('a')
                ->join('comment b','a.demand_id=b.demand_id','left')->where('a.teacher_id', $teacher_id)->where('b.sup_comment_id', 0)->count();

            if($info['itic_img']){
                $info['certificate_num'] = 2;
            }elseif($info['diploma_img']){
                $info['certificate_num'] = 1;
            }elseif($info['student_card_img']){
                $info['certificate_num'] = 0;
            }else{
                $info['certificate_num'] = -1;
            }


            $this->view->assign('info', $info);

            if($type==1){
                return view('index/update_resume1');
            }elseif ($type==2){
                return view('index/update_resume2');
            }else{
                return view('index/update_resume3');
            }

        }

    }


    /**
     *简历预览
     */
    public function resumeView()
    {
        if(request()->isPost()) {
            //教师信息
            $teacher_info = db('teacher')->where('mid',$this->mid)->find();
            $subject_id = explode(',',$teacher_info['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

            return json(['status' => 200, 'data' => $teacher_info]);
        }else{

            $teacher_id = $this->request->param('teacher_id', '', 'intval');
            $mid = $this->mid;

            $where[] = ['a.mid','=',$mid];

            $info = db("teacher")->alias('a')
                ->field('a.*,b.nickname,b.avatar,b.login_time')
                ->join('member b','a.mid=b.mid','left')
                ->where($where)
                ->find();

            $info['login_time'] = time_tran($info['login_time']);
            $info['name'] = getShortName($info['name']);

            $subject_id = explode(',',$info['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $info['subject_names'] = db('subject')->where($where1)->column('name');

            $info['is_collect'] = 0;
            if($mid){
                //判断当前用户是否 收藏该老师  is_collect 0未收藏  1已收藏
                $has = db("collect")->where('mid', $mid)->where('teacher_id', $teacher_id)->find();
                if($has){
                    $info['is_collect'] = 1;
                }
            }

            //查询 老师所在城市 是否可以直接联系
            $is_direct_contact = db('direct_contact')->where("city like '".$info['city']."%'")->find();
            $info['is_direct_contact'] = 0;
            if($is_direct_contact['is_open']==1){
                $info['is_direct_contact'] = 1;
            }

            $info['subject_names_str'] = implode(',',$info['subject_names']);
            $info['gender_str'] = getGenderStr($info['gender']);
            $info['teacher_identity_str'] = getTeacherIdentityStr($info['teacher_identity']);
            $info['teaching_way_str'] = getTeachingWayStr($info['teaching_way']);

            //评价数
            $info['comment_num'] =db('demand')->alias('a')
                ->join('comment b','a.demand_id=b.demand_id','left')->where('a.teacher_id', $teacher_id)->where('b.sup_comment_id', 0)->count();

            $this->view->assign('info', $info);

            return view('index/resume_view');
        }

    }


    /**
     * 修改订单状态
     */
    public function updateOrderStatus()
    {
        $order_id = $this->request->param('order_id', '', '');
        $status = $this->request->param('status', '', '');
        $refund_cause = $this->request->param('refund_cause', '', '');

        if(!$status || !$order_id){
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $order_info = db("order")->where('order_id', $order_id)->find();

        if(!$order_info){
            return json(['status' => 404, 'msg' => '对不起,没有找到该订单信息']);
        }


        if($status==2){
            if($order_info['status'] != 1){
                return json(['status' => 404, 'msg' => '该订单不是已支付状态,不能申请退款']);
            }

            //type  支付订单|1|primary,助力订单|2|success
            if($order_info['type'] != 1){
                return json(['status' => 404, 'msg' => '该订单为助力订单,不能申请退款']);
            }

            if(!$refund_cause){
                return json(['status' => 404, 'msg' => '请上传退款原因']);
            }
        }

        if($status==4){
            if($order_info['status'] == 0){
                return json(['status' => 404, 'msg' => '该订单为待支付状态,不能确认完成']);
            }
            if($order_info['status'] == 3){
                return json(['status' => 404, 'msg' => '该订单为已退款状态,不能确认完成']);
            }
            if($order_info['status'] == 4){
                return json(['status' => 404, 'msg' => '该订单为已完成状态,不能确认完成']);
            }
            //需求
            $demand_info = db('demand')->where('demand_id', $order_info['demand_id'])->find();

            if($demand_info['status']!=0){
                return json(['status' => 404, 'msg' => '该订单关联的需求信息,不为待上订单,不能确认完成']);
            }
        }

        try {
            db()->startTrans();

            //修改订单状态   pay_time 操作时间
            db("order")->where('order_id',$order_id)->update(['status'=>$status,'refund_cause'=>$refund_cause,'pay_time'=>time()]);

            if($status==4){
                //修改需求
                db('demand')->where('demand_id', $order_info['demand_id'])->update(['status'=>1,'teacher_id'=>$order_info['teacher_id']]);
                //删除 其他 该需求的 预约订单
                db('appointment')->where('demand_id',$order_info['demand_id'])->delete();
                //删除 其他 该需求的 未完成的待付订单
                db('order')->where('demand_id',$order_info['demand_id'])->where('order_id','<>',$order_id)->where('status',0)->delete();
                //修改其他 改需求的 未完成的 已支付订单
                //支付订单
                db('order')->where('demand_id',$order_info['demand_id'])->where('order_id','<>',$order_id)->where('status',1)->where('type',1)->update(['status'=>2,'refund_cause'=>'订单已由其它教员完成','pay_time'=>time()]);
                //助力订单
                db('order')->where('demand_id',$order_info['demand_id'])->where('order_id','<>',$order_id)->where('status',1)->where('type',2)->update(['status'=>4,'refund_cause'=>'订单已由其它教员完成','pay_time'=>time()]);
            }

            if($status==2){
                //查询该用户的订单退单率
                $teacher_info = db('teacher')->where('teacher_id', $order_info['teacher_id'])->find();
                //后台设置 后多少单参与下线运算
                $last_orders = config("config.last_orders");
                //后台设置 参与下线运算 退款订单占比
                $refund_order_prop = config("config.refund_order_prop");

                //查询 未参与 下线指标的 订单总数
                $wcy_order_num = db('order')->where('mid', $order_info['mid'])->where('is_operation', 0)->order('create_time desc')->count();

                //如果未参与 下线指标的 订单总数  大于等于  后台设置的订单数 则计算
                if($wcy_order_num>=$last_orders){
                    //参与运算的 退款订单数
                    $last_order_list = db('order')->where('mid', $order_info['mid'])->where('is_operation', 0)->order('create_time desc')->limit($last_orders)->select()->toArray();
                    //计算参与运算的后几单 中 申请退款的数量
                    $tk_count = 0;
                    foreach ($last_order_list as $k=>$v){
                        if($v['status']==2){
                            $tk_count++;
                        }
                    }
                    //参与运算的 正常订单数
                    $zc_count = $last_orders-$tk_count;
                    //计算参与运算的订单 申请退款订单的占比
                    if($zc_count!=0){
                        $prop = ($tk_count/$zc_count)*100;
                    }else{
                        $prop = 0;
                    }

                    //如果比例大于后台设置 的占比 则将该用户老师账号 下线
                    if($prop>=$refund_order_prop){
                        //将老师的 状态改为 下线  添加老师下线次数
                        $offline_num = $teacher_info['offline_num']+1;
                        db('teacher')->where('teacher_id', $order_info['teacher_id'])->update(['is_on_off'=>2,'offline_num'=>$offline_num]);

                        //添加老师下线记录
                        $ins['mid'] = $teacher_info['mid'];
                        $ins['teacher_id'] = $teacher_info['teacher_id'];
                        $ins['teacher_name'] = $teacher_info['name'];
                        $ins['create_time'] = time();
                        db('offline')->insert($ins);
                    }
                }
            }

            //订单确认 合作
            if($status==4){
                //添加老师任教次数
                db('teacher')->where('teacher_id', $order_info['teacher_id'])->inc('teach_num')->update();
            }

            db()->commit();
        } catch (\Exception $e) {
            db()->rollback();
            abort(config('my.error_log_code'), $e->getMessage());
        }


        return json(['status' => 200, 'msg' => '修改成功']);
    }


}