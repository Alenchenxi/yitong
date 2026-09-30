<?php

namespace app\cms\controller;
use app\cms\service\BaseService;

class Index extends Base
{
    /**
     * 获取首页内容
     */
    public function index(){
	    //首页轮播图
        $slide_list = db('slide')->where('status',1)->select()->toArray();

        //首页消息
        $msg_list = db('content')->where('class_id',1)->where('status',1)->limit(1)->select()->toArray();
        foreach ($msg_list as $k => $v) {
            $msg_list[$k]['detail'] = format_html($msg_list[$k]['detail']);
            $msg_list[$k]['create_time'] = date('Y-m-d H:i:s', $msg_list[$k]['create_time']);
        }

        //最新咨询
        $new_msg_list = db('content')->where('class_id',3)->where('status',1)->limit(5)->order('create_time desc')->select()->toArray();
        foreach ($new_msg_list as $k => $v) {
            $new_msg_list[$k]['detail'] = format_html($new_msg_list[$k]['detail']);
            $new_msg_list[$k]['create_time'] = date('Y-m-d H:i:s', $new_msg_list[$k]['create_time']);
        }

        if($this->city){
            $where[] = ['a.city','like',"$this->city"];
        }

        //最新学生
        $demand_list = db("demand")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time,c.name as subject_name,d.fee_set as expense')
            ->join('member b','a.mid=b.mid','left')
            ->join('subject c','a.subject_id=c.subject_id','left')
            ->join('teach_fee d','a.teach_fee_id=d.teach_fee_id','left')
            ->where($where)
            ->order('a.create_time desc')->limit(5)
            ->select()->toArray();
        foreach ($demand_list as $k => $v) {
            $demand_list[$k]['login_time'] = time_tran($demand_list[$k]['login_time']);
            $demand_list[$k]['create_time'] = date('Y-m-d H:i:s',$demand_list[$k]['create_time']);
        }

        //最新老师
        $teacher_list = db("teacher")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time')
            ->join('member b','a.mid=b.mid','left')
            ->where('a.status',1)
            ->where($where)
            ->order('a.teacher_id desc')
            ->limit(5)
            ->select()->toArray();

        foreach ($teacher_list as $k => $v) {
            $teacher_list[$k]['login_time'] = time_tran($teacher_list[$k]['login_time']);
            $teacher_list[$k]['name'] = getShortName($teacher_list[$k]['name']);

            $subject_id = explode(',',$v['subject_id']);
            $where1 = [];
            $where1[] = ['subject_id','in',$subject_id];
            $teacher_list[$k]['subject_names'] = db('subject')->where($where1)->limit(3)->select()->toArray();
        }

        //查询首页 展示的 年级列表
        $grade_list = db('grade')->order('zsort asc')->limit(8)->select()->toArray();


        $data['slide_list'] = $slide_list;
        $data['msg_list'] = $msg_list;
        $data['homepage_title'] = config('config.homepage_title');
        $data['grade_list'] = $grade_list;

        $data['new_msg_list'] = $new_msg_list;
        $data['new_demand_list'] = $demand_list;
        $data['new_teacher_list'] = $teacher_list;

        $this->view->assign('nav', 1);
        $this->view->assign('info', $data);
        $this->view->assign('title', '首页');
        return view();
    }

    /**
     * 获取热门城市和省份列表
     */
    public function city()
    {
        if(request()->isPost()) {
            //获取当前选择的城市
            $city = $this->request->param('city', '', '');
            session('city', $city);
            return json(['status' => 200, 'msg' => '选择成功']);

        }else{
            //获取热门城市
            $hot_city_list = db('area')->where("is_hot",1)->order('listorder asc,id asc')->select()->toArray();

            //总共有多少省份
            $total_province_num = db("area")->where('parentid',0)->count();

            $num = ceil($total_province_num/4);

            $province = [];
            for ($i=1; $i<=$num; $i++){
                //获取省列表
                $province_list = db("area")->where('parentid',0)->order('listorder asc,id asc')->limit(($i - 1) * 4, 4)->select()->toArray();

                foreach ($province_list as $k=>$v){
                    $province_list[$k]['city_list'] = db("area")->where('parentid',$v['id'])->order('listorder asc,id asc')->select()->toArray();
                }

                $province[] = $province_list;
            }



            $data['hot_city_list'] = $hot_city_list;
            $data['province_list'] = $province;

            $this->view->assign('data', $data);

            return view('index/city');
        }

    }


    /**
     * 搜索页面
     */
    public function search()
    {
        if(request()->isPost()) {

        }else{

            return view('index/search');
        }

    }


    /**
     * 获取课酬列表
     */
    public function getSalaryList(){
        $salary = [];

        $list = db("teach_fee")->select()->toArray();
        foreach ($list as $k=>$v){
            $data1['label'] = $v['fee_set'];
            $data1['value'] = $v['fee_set'];

            $salary[] = $data1;
        }

        return json(['status' => 200, 'data' => $salary]);
    }


    /**
     * 获取当前城市区域列表
     */
    public function getAreaList(){
        $quyu = [];
        $city_info = db('area')->where("name like '$this->city'")->find();
        $area_list = db("area")->where('parentid',$city_info['id'])->select()->toArray();
        foreach ($area_list as $k=>$v){
            $data1['label'] = $v['name'];
            $data1['value'] = $v['name'];

            $quyu[] = $data1;
        }

        return json(['status' => 200, 'data' => $quyu]);
    }


    /**
     * 获取科目选择器列表
     */
    public function getSubjectList(){
        $kemu = [];
        $grade_list = db('grade')->select()->toArray();
        foreach ($grade_list as $k=>$v){
            $data[$k]['label'] = $v['name'];
            $data[$k]['value'] = $v['grade_id'];

            $subject_list = db('subject')->where('grade_id',$v['grade_id'])->select()->toArray();

            foreach ($subject_list as $sk=>$sv){
                $data2['label'] = $sv['name'];
                $data2['value'] = $sv['subject_id'];

                $data[$k]['children'][] = $data2;
            }

        }
        $kemu = $data;

        return json(['status' => 200, 'data' => $kemu]);
    }


    /**
     * @api {post} /index/getSetMeal 、 获取套餐
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取套餐
     */
    public function getSetMeal()
    {
        $list = db('set_meal')->select()->toArray();
        return json(['status' => 200, 'data' => $list]);
    }


    /**
     * @api {post} /index/getSearchList 18、 获取查询列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取查询列表
     * @apiParam (输入参数：) {string}      keyword 	关键词
     * @apiParam (输入参数：) {number}      type  类型  0教员  1学员
     */
    public function getSearchList()
    {
        $type = $this->request->param('type', 0, 'intval');
        $keyword = $this->request->param('keyword', '', '');

        if(!$keyword){
            return json(['status' => 404, 'msg' => '请输入搜索内容']);
        }

        if($type==0){
            //获取 为隐藏简历的
            $where = [];
            $where[] = ['a.is_hide','=',0];
            $where[] = ['a.status','=',1];
            $where[] = ['a.is_on_off','=',1];
            $where[] = ['a.name|b.nickname|a.city|a.area|a.school|a.specialty|a.self_desc|a.experience','like',"%$keyword%"];

            $list = db("teacher")->alias('a')
                ->field('a.*,b.nickname,b.avatar,b.login_time')
                ->join('member b','a.mid=b.mid','left')
                ->where($where)
                ->order('a.stick_time desc,a.refresh_time desc,a.teacher_id desc')
                ->select()->toArray();

            foreach ($list as $k => $v) {
                $list[$k]['login_time'] = time_tran($list[$k]['login_time']);

                $subject_id = explode(',',$v['subject_id']);
                $where1 = [];
                $where1[] = ['subject_id','in',$subject_id];
                $list[$k]['subject_names'] = db('subject')->where($where1)->select()->toArray();
            }
        }else{

            $where = [];
            $where[] = ['a.status','<>',2];
            $where[] = ['c.name|a.city|a.area|a.gai_kuang','like',"%$keyword%"];

            $list = db("demand")->alias('a')
                ->field('a.*,b.nickname,b.avatar,b.login_time,c.name as subject_name')
                ->join('member b','a.mid=b.mid','left')
                ->join('subject c','a.subject_id=c.subject_id','left')
                ->where($where)
                ->order('a.create_time desc')
                ->select()->toArray();

            foreach ($list as $k => $v) {
                $list[$k]['login_time'] = time_tran($list[$k]['login_time']);
                $list[$k]['create_time'] = date('Y-m-d H:i:s',$list[$k]['create_time']);
            }


        }

        return json(['status' => 200, 'data' => $list]);
    }

}
