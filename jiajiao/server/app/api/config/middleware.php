<?php

return [
	'alias' => [
		'JwtAuth'	=>	app\api\middleware\JwtAuth::class,
		'SmsAuth'	=>	app\api\middleware\SmsAuth::class,
		'CaptchaAuth'=>	app\api\middleware\CaptchaAuth::class,
	],	
];
