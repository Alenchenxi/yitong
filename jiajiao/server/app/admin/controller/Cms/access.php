<?php

//Cms菜单配置

return [
	[
		'text' => 'CMS管理(admin/Cms)',
		'icon' => 'fa fa-clone',
		'state'=>['opened'=>true,'selected'=>false],
		'a_attr' => ['data-id'=>'admin/Cms'],
		'children' =>[
			[
                'text' => '栏目管理(admin/Cms.Catagory)',
				'state'=>['opened'=>true,'selected'=>false],
                'a_attr' => ['data-id'=>'admin/Cms.Catagory'],
				'children'=>[
					[
						'text'	=> '首页数据列表(admin/Cms.Catagory/index)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Catagory/index'],
					],
					[
						'text'	=> '修改状态排序(admin/Cms.Catagory/updateExt)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Catagory/updateExt'],
					],
					[
						'text'	=> '添加栏目(admin/Cms.Catagory/add)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Catagory/add'],
					],
					[
						'text'	=> '修改栏目(admin/Cms.Catagory/update)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Catagory/update'],
					],
					[
						'text'	=> '删除栏目(admin/Cms.Catagory/delete)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Catagory/delete'],
					],
					[
						'text'	=> '栏目排序(admin/Cms.Catagory/setSort)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Catagory/setSort'],
					],
				],
            ],
            [
                'text' => '文章管理(admin/Cms.Content)',
				'state'=>['opened'=>true,'selected'=>false],
                'a_attr' => ['data-id'=>'admin/Cms.Content'],
				'children'	=> [
					[
						'text'	=> '首页数据列表(admin/Cms.Content/index)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/index'],
					],
					[
						'text'	=> '修改状态排序(admin/Cms.Content/updateExt)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/updateExt'],
					],
					[
						'text'	=> '添加文章(admin/Cms.Content/add)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/add'],
					],
					[
						'text'	=> '修改文章(admin/Cms.Content/update)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/update'],
					],
					[
						'text'	=> '删除文章(admin/Cms.Content/delete)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/delete'],
					],
					[
						'text'	=> '文章排序(admin/Cms.Content/setSort)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/setSort'],
					],
					[
						'text'	=> '设置推荐位(admin/Cms.Content/setPosition)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/setPosition'],
					],
					[
						'text'	=> '删除推荐位(admin/Cms.Content/delPosition)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/delPosition'],
					],
					[
						'text'	=> '文章移动(admin/Cms.Content/move)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Content/move'],
					],
				],
            ],
			[
                'text' => '碎片管理(admin/Cms.Frament)',
				'state'=>['opened'=>true,'selected'=>false],
                'a_attr' => ['data-id'=>'admin/Cms.Frament'],
				'children'	=> [
					[
						'text'	=> '首页数据列表(admin/Cms.Frament/index)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Frament/index'],
					],
					[
						'text'	=> '修改状态排序(admin/Cms.Frament/updateExt)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Frament/updateExt'],
					],
					[
						'text'	=> '添加碎片(admin/Cms.Frament/add)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Frament/add'],
					],
					[
						'text'	=> '修改碎片(admin/Cms.Frament/update)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Frament/update'],
					],
					[
						'text'	=> '删除碎片(admin/Cms.Frament/delete)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Frament/delete'],
					]
				],
            ],
			[
                'text' => '推荐位管理(admin/Cms.Position)',
				'state'=>['opened'=>true,'selected'=>false],
                'a_attr' => ['data-id'=>'admin/Cms.Position'],
				'children'	=> [
					[
						'text'	=> '首页数据列表(admin/Cms.Position/index)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Position/index'],
					],
					[
						'text'	=> '修改状态排序(admin/Cms.Position/updateExt)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Position/updateExt'],
					],
					[
						'text'	=> '添加推荐位(admin/Cms.Position/add)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Position/add'],
					],
					[
						'text'	=> '修改推荐位(admin/Cms.Position/update)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Position/update'],
					],
					[
						'text'	=> '删除推荐位(admin/Cms.Position/delete)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.Position/delete'],
					]
				],
            ],
			[
                'text' => '静态生成(admin/Cms.DoHtml)',
				'state'=>['opened'=>true,'selected'=>false],
                'a_attr' => ['data-id'=>'admin/Cms.DoHtml'],
				'children'	=> [
					[
						'text'	=> '查看页面(admin/Cms.DoHtml/index)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.DoHtml/index'],
					],[
						'text'	=> '生成首页(admin/Cms.DoHtml/doIndex)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.DoHtml/doIndex'],
					],
					[
						'text'	=> '生成列表页(admin/Cms.DoHtml/doList)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.DoHtml/doList'],
					],
					[
						'text'	=> '生成详情页(admin/Cms.DoHtml/doView)',
						'icon' => 'fa fa-clone',
						'state'=>['opened'=>true,'selected'=>false],
						'a_attr'	=> ['data-id'=>'admin/Cms.DoHtml/doView'],
					]
				],
            ],
		],
	],
];